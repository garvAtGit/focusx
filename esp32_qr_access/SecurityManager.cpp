#include "SecurityManager.h"
#include "config.h"
#include <ArduinoJson.h>
#include <mbedtls/md.h>
#include <mbedtls/pk.h>
#include <mbedtls/error.h>
#include <mbedtls/base64.h>
#include <time.h>

SecurityManager::SecurityManager() {}

void SecurityManager::init() {
    // Initialization if required
}

QRPayload SecurityManager::processQR(const String& rawJson) {
    QRPayload result;
    result.isValid = false;
    result.failReason = "Unknown Error";

    // 1. Parse JSON
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, rawJson);

    if (error) {
        Serial.print("JSON parse failed: ");
        Serial.println(error.c_str());
        result.failReason = "Invalid JSON";
        result.uid = "UNKNOWN";
        return result;
    }

    if (!doc.containsKey("uid") || !doc.containsKey("iat") || !doc.containsKey("qid") || !doc.containsKey("sig")) {
        Serial.println("Missing required QR fields");
        result.failReason = "Missing Fields";
        result.uid = doc.containsKey("uid") ? doc["uid"].as<String>() : "UNKNOWN";
        return result;
    }

    result.uid = doc["uid"].as<String>();
    result.iat = doc["iat"].as<time_t>();
    result.qid = doc["qid"].as<String>();
    result.doorId = doc.containsKey("door") ? doc["door"].as<String>() : String(DOOR_ID);
    result.sig = doc["sig"].as<String>();
    
    // Optional provisioning fields
    if (doc.containsKey("cmd")) result.cmd = doc["cmd"].as<String>();
    if (doc.containsKey("ssid")) result.ssid = doc["ssid"].as<String>();
    if (doc.containsKey("pass")) result.pass = doc["pass"].as<String>();
    if (doc.containsKey("libId")) result.libId = doc["libId"].as<String>();
    
    // Optional RFID command fields
    if (doc.containsKey("rfid")) result.rfid = doc["rfid"].as<String>();
    if (doc.containsKey("exp")) result.exp = doc["exp"].as<time_t>();

    // 2. Verify Time validity
    time_t now;
    time(&now);
    
    // Check if QR is too old (or from the future by a large margin)
    if (now > result.iat + QR_VALIDITY_SECONDS) {
        Serial.println("QR Code Expired!");
        result.failReason = "Expired QR";
        return result;
    }
    
    if (now < result.iat - 60) {
        // NTP drift allowance
        Serial.println("QR Code is from the future? Check NTP sync.");
        result.failReason = "Future Timestamp (NTP Out of Sync?)";
        return result;
    }

    // 3. Verify ECDSA Signature
    String payloadStr = "";
    
    if (doc.containsKey("cmd") && (doc["cmd"].as<String>() == "ADD_RFID" || doc["cmd"].as<String>() == "REVOKE_RFID")) {
        // payload = cmd + rfid + exp + uid + iat + qid
        String cmd = doc["cmd"].as<String>();
        String rfid = doc.containsKey("rfid") ? doc["rfid"].as<String>() : "";
        String exp = doc.containsKey("exp") ? doc["exp"].as<String>() : "0";
        payloadStr = cmd + rfid + exp + result.uid + String(result.iat) + result.qid;
    } else if (doc.containsKey("cmd") && doc["cmd"].as<String>() == "PROVISION") {
        // payload = uid + iat + qid + ssid + pass + libId
        if (!doc.containsKey("ssid") || !doc.containsKey("pass") || !doc.containsKey("libId")) {
            result.failReason = "Provisioning QR Missing Fields";
            return result;
        }
        payloadStr = result.uid + String(result.iat) + result.qid + doc["ssid"].as<String>() + doc["pass"].as<String>() + doc["libId"].as<String>();
    } else {
        // Default entry QR payload: uid + iat + qid
        payloadStr = result.uid + String(result.iat) + result.qid;
    }

    if (!verifyECDSASignature(payloadStr, result.sig)) {
        Serial.println("Signature verification failed!");
        result.failReason = "Invalid Signature (Forged/Tampered)";
        return result;
    }

    // 4. Check Replay Attack
    time_t expiry = result.iat + QR_VALIDITY_SECONDS;
    if (!checkReplay(result.qid, expiry)) {
        Serial.println("Replay attack detected!");
        result.failReason = "Replay Attack (Already Scanned)";
        return result;
    }

    result.isValid = true;
    result.failReason = ""; // Clear error on success
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
    time_t now;
    time(&now);
    
    for (auto it = replayCache.begin(); it != replayCache.end(); ) {
        if (now > it->expiry) {
            it = replayCache.erase(it);
        } else {
            ++it;
        }
    }
}

bool SecurityManager::verifyECDSASignature(const String& payloadStr, const String& signatureBase64) {
    int ret;
    mbedtls_pk_context pk;
    mbedtls_pk_init(&pk);

    // Parse the embedded public key
    ret = mbedtls_pk_parse_public_key(&pk, (const unsigned char*)ECDSA_PUBLIC_KEY, strlen(ECDSA_PUBLIC_KEY) + 1);
    if (ret != 0) {
        Serial.printf("Failed to parse public key: -0x%04x\n", -ret);
        mbedtls_pk_free(&pk);
        return false;
    }

    // Hash the payload with SHA256
    unsigned char hash[32];
    ret = mbedtls_md(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), (const unsigned char*)payloadStr.c_str(), payloadStr.length(), hash);
    if (ret != 0) {
        Serial.println("Failed to hash payload");
        mbedtls_pk_free(&pk);
        return false;
    }

    // Decode Base64 signature
    unsigned char sigBuf[128];
    size_t sigLen = 0;
    ret = mbedtls_base64_decode(sigBuf, sizeof(sigBuf), &sigLen, (const unsigned char*)signatureBase64.c_str(), signatureBase64.length());
    if (ret != 0) {
        Serial.println("Failed to decode base64 signature");
        mbedtls_pk_free(&pk);
        return false;
    }

    // Verify ECDSA signature
    ret = mbedtls_pk_verify(&pk, MBEDTLS_MD_SHA256, hash, sizeof(hash), sigBuf, sigLen);
    
    mbedtls_pk_free(&pk);

    if (ret != 0) {
        Serial.printf("Signature mismatch: -0x%04x\n", -ret);
        return false;
    }

    return true;
}
