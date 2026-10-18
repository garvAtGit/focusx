#include "SecurityManager.h"
#include "config.h"
#include <ArduinoJson.h>
#include <time.h>
#include <BearSSLHelpers.h>

SecurityManager::SecurityManager() {}

void SecurityManager::init() {
    // Initialization if required
}

String SecurityManager::detectQRType(const String& rawJson) {
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, rawJson);
    
    if (error) {
        return "unknown";
    }
    
    if (doc.containsKey("type")) {
        return doc["type"].as<String>();
    }
    
    // No "type" field = access QR (backward compatible)
    return "access";
}

WiFiConfigPayload SecurityManager::processWiFiQR(const String& rawJson) {
    WiFiConfigPayload result;
    result.isValid = false;

    // 1. Parse JSON
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, rawJson);

    if (error) {
        Serial.print("[WiFi QR] JSON parse failed: ");
        Serial.println(error.c_str());
        return result;
    }

    if (!doc.containsKey("ssid") || !doc.containsKey("pass") || 
        !doc.containsKey("iat") || !doc.containsKey("qid") || !doc.containsKey("sig")) {
        Serial.println("[WiFi QR] Missing required fields");
        return result;
    }

    result.ssid = doc["ssid"].as<String>();
    result.pass = doc["pass"].as<String>();
    result.iat  = doc["iat"].as<time_t>();
    result.qid  = doc["qid"].as<String>();
    result.sig  = doc["sig"].as<String>();

    // 2. Verify Time validity (3-minute window)
    time_t now = time(nullptr);
    
    if (now > result.iat + WIFI_QR_VALIDITY_SECONDS) {
        Serial.println("[WiFi QR] QR Code Expired!");
        return result;
    }
    
    if (now < result.iat - 60) {
        Serial.println("[WiFi QR] QR Code is from the future? Check NTP sync.");
        return result;
    }

    // 3. Verify ECDSA Signature (payload = ssid + pass + iat + qid)
    String payloadStr = result.ssid + result.pass + String((unsigned long)result.iat) + result.qid;
    if (!verifyECDSASignature(payloadStr, result.sig)) {
        Serial.println("[WiFi QR] Signature verification failed!");
        return result;
    }

    // 4. Check Replay Attack
    time_t expiry = result.iat + WIFI_QR_VALIDITY_SECONDS;
    if (!checkReplay(result.qid, expiry)) {
        Serial.println("[WiFi QR] Replay attack detected!");
        return result;
    }

    result.isValid = true;
    return result;
}

QRPayload SecurityManager::processQR(const String& rawJson) {
    QRPayload result;
    result.isValid = false;

    // 1. Parse JSON
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, rawJson);

    if (error) {
        Serial.print("JSON parse failed: ");
        Serial.println(error.c_str());
        return result;
    }

    if (!doc.containsKey("uid") || !doc.containsKey("iat") || !doc.containsKey("qid") || !doc.containsKey("sig")) {
        Serial.println("Missing required QR fields");
        return result;
    }

    result.uid = doc["uid"].as<String>();
    result.iat = doc["iat"].as<time_t>();
    result.qid = doc["qid"].as<String>();
    result.doorId = doc.containsKey("door") ? doc["door"].as<String>() : String(DOOR_ID);
    result.sig = doc["sig"].as<String>();

    // 2. Verify Time validity
    time_t now = time(nullptr);
    
    if (now > result.iat + QR_VALIDITY_SECONDS) {
        Serial.println("QR Code Expired!");
        return result;
    }
    
    if (now < result.iat - 60) {
        Serial.println("QR Code is from the future? Check NTP sync.");
        return result;
    }

    String payloadStr = "";
    
    if (doc.containsKey("cmd") && (doc["cmd"].as<String>() == "ADD_RFID" || doc["cmd"].as<String>() == "REVOKE_RFID")) {
        // payload = cmd + rfid + exp + uid + iat + qid
        String cmd = doc["cmd"].as<String>();
        String rfid = doc.containsKey("rfid") ? doc["rfid"].as<String>() : "";
        String exp = doc.containsKey("exp") ? doc["exp"].as<String>() : "0";
        payloadStr = cmd + rfid + exp + result.uid + String((unsigned long)result.iat) + result.qid;
    } else if (doc.containsKey("cmd") && doc["cmd"].as<String>() == "PROVISION") {
        // payload = uid + iat + qid + ssid + pass + libId
        if (!doc.containsKey("ssid") || !doc.containsKey("pass") || !doc.containsKey("libId")) {
            return result; // Missing Fields
        }
        payloadStr = result.uid + String((unsigned long)result.iat) + result.qid + doc["ssid"].as<String>() + doc["pass"].as<String>() + doc["libId"].as<String>();
    } else {
        // Default entry QR payload: uid + iat + qid
        payloadStr = result.uid + String((unsigned long)result.iat) + result.qid;
    }

    if (!verifyECDSASignature(payloadStr, result.sig)) {
        Serial.println("Signature verification failed!");
        return result;
    }

    // 4. Check Replay Attack
    time_t expiry = result.iat + QR_VALIDITY_SECONDS;
    if (!checkReplay(result.qid, expiry)) {
        Serial.println("Replay attack detected!");
        return result;
    }

    result.isValid = true;
    return result;
}

bool SecurityManager::checkReplay(const String& qid, time_t expiry) {
    // Check if already used
    for (const auto& entry : replayCache) {
        if (entry.qid == qid) {
            return false; // Used!
        }
    }
    // Valid, add to cache
    replayCache.push_back({qid, expiry});
    return true;
}

void SecurityManager::purgeReplayCache() {
    time_t now = time(nullptr);
    
    for (auto it = replayCache.begin(); it != replayCache.end(); ) {
        if (now > it->expiry) {
            it = replayCache.erase(it);
        } else {
            ++it;
        }
    }
}

// =====================================================
// ECDSA P-256 Signature Verification using BearSSL
// (Replaces mbedtls on ESP32)
// DEBUG VERSION — verbose output for troubleshooting
// =====================================================
bool SecurityManager::verifyECDSASignature(const String& payloadStr, const String& signatureBase64) {
    Serial.println("[ECDSA] ========== VERIFICATION DEBUG (TESTING V2) ==========");

    // --- Step 1: Print payload ---
    Serial.println("[ECDSA] Payload: " + payloadStr);
    Serial.println("[ECDSA] Payload length: " + String(payloadStr.length()));

    // --- Step 2: Parse the PEM public key ---
    BearSSL::PublicKey pubKey(ECDSA_PUBLIC_KEY);
    const br_ec_public_key* ecKey = pubKey.getEC();
    if (!ecKey) {
        Serial.println("[ECDSA] FAIL: Could not parse EC public key from PEM");
        return false;
    }
    Serial.printf("[ECDSA] EC Key — curve: %d (23=P256), qlen: %u\n", ecKey->curve, (unsigned)ecKey->qlen);
    Serial.print("[ECDSA] EC Key Q: ");
    for (size_t i = 0; i < ecKey->qlen; i++) {
        Serial.printf("%02X", ecKey->q[i]);
    }
    Serial.println();

    // --- Step 3: SHA-256 hash of the payload ---
    br_sha256_context sha256ctx;
    br_sha256_init(&sha256ctx);
    br_sha256_update(&sha256ctx, payloadStr.c_str(), payloadStr.length());
    unsigned char hash[br_sha256_SIZE];
    br_sha256_out(&sha256ctx, hash);

    Serial.print("[ECDSA] SHA-256: ");
    for (int i = 0; i < br_sha256_SIZE; i++) {
        Serial.printf("%02X", hash[i]);
    }
    Serial.println();

    // --- Step 4: Decode Base64 signature ---
    Serial.println("[ECDSA] Sig B64: " + signatureBase64);
    unsigned char sigBuf[128];
    int sigLen = base64Decode(signatureBase64.c_str(), signatureBase64.length(), sigBuf, sizeof(sigBuf));
    if (sigLen <= 0) {
        Serial.println("[ECDSA] FAIL: Base64 decode returned " + String(sigLen));
        return false;
    }
    Serial.printf("[ECDSA] Sig DER (%d bytes): ", sigLen);
    for (int i = 0; i < sigLen; i++) {
        Serial.printf("%02X", sigBuf[i]);
    }
    Serial.println();

    // --- Step 5: Verify ECDSA signature ---
    const br_ec_impl* ecImpl = br_ec_get_default();
    br_ecdsa_vrfy vrfy = br_ecdsa_vrfy_asn1_get_default();
    
    if (!vrfy) {
        Serial.println("[ECDSA] FAIL: br_ecdsa_vrfy_asn1_get_default returned NULL");
        return false;
    }

    if (!ecImpl) {
        Serial.println("[ECDSA] FAIL: br_ec_get_default returned NULL");
        return false;
    }

    // BearSSL::PublicKey strips the 0x04 prefix from the public key, but br_ecdsa_vrfy_asn1 EXPECTS IT!
    // We must manually prepend the 0x04 byte to create a valid uncompressed point representation.
    // Ensure 32-bit alignment for BearSSL internals to prevent Exception (28) LoadProhibited on ESP8266
    uint32_t alignedQ[17]; // 68 bytes, guaranteed 4-byte aligned
    unsigned char* fullQ = (unsigned char*)alignedQ;
    
    fullQ[0] = 0x04; // Uncompressed point indicator
    if (ecKey->qlen == 64) {
        memcpy(fullQ + 1, ecKey->q, 64);
    } else {
        Serial.println("[ECDSA] FAIL: Unexpected qlen (not 64)");
        return false;
    }

    br_ec_public_key rawKey;
    rawKey.curve = ecKey->curve;
    rawKey.q = fullQ;
    rawKey.qlen = 65;

    uint32_t result = vrfy(ecImpl, hash, br_sha256_SIZE, &rawKey, sigBuf, (size_t)sigLen);
    Serial.printf("[ECDSA] Verify result: %u (1=OK, 0=FAIL)\n", result);
    Serial.println("[ECDSA] ============================================");

    if (result != 1) {
        Serial.println("Signature mismatch");
        return false;
    }

    return true;
}

// =====================================================
// Self-contained Base64 Decoder
// (Replaces mbedtls_base64_decode)
// =====================================================
int SecurityManager::base64Decode(const char* input, size_t inputLen,
                                   unsigned char* output, size_t outputMaxLen) {
    size_t outLen = 0;
    uint32_t accum = 0;
    int bits = 0;

    for (size_t i = 0; i < inputLen; i++) {
        char c = input[i];
        int val = -1;

        if (c >= 'A' && c <= 'Z')      val = c - 'A';
        else if (c >= 'a' && c <= 'z')  val = c - 'a' + 26;
        else if (c >= '0' && c <= '9')  val = c - '0' + 52;
        else if (c == '+')              val = 62;
        else if (c == '/')              val = 63;
        else if (c == '=')             continue; // Padding
        else                           continue; // Skip whitespace / newlines

        accum = (accum << 6) | (uint32_t)val;
        bits += 6;

        if (bits >= 8) {
            bits -= 8;
            if (outLen >= outputMaxLen) return -1; // Buffer overflow
            output[outLen++] = (unsigned char)((accum >> bits) & 0xFF);
        }
    }

    return (int)outLen;
}
