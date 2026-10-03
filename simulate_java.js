function formatUUID() {
    const appleData = [
        0x02, 0x15, 
        0x87, 0xb9, 0x9b, 0x2c,
        0x90, 0xfd, 0x11, 0xe9,
        0xbc, 0x42, 0x52, 0x6a,
        0xf7, 0x76, 0x4f, 0x64,
        0x00, 0x01, 0x00, 0x01, 0xC5
    ];
    
    // Kotlin/Java treats bytes as signed (-128 to 127).
    // Let's convert them to signed bytes.
    const signedBytes = appleData.map(b => b > 127 ? b - 256 : b);
    
    const uuidBytes = signedBytes.slice(2, 18);
    
    // In Java, String.format("%02x", signedByte) converts the signedByte to an Integer (32-bit).
    // Sign extension happens.
    // e.g. -121 becomes 0xFFFFFF87.
    // %02x on a 32-bit negative integer prints the full 8-hex-character string.
    
    const parts = uuidBytes.map(b => {
        if (b < 0) {
            // Sign extend to 32 bits and get hex
            let hex = (b >>> 0).toString(16);
            return hex; // e.g. ffffff87
        } else {
            return b.toString(16).padStart(2, '0');
        }
    });
    
    const uuidStr = `${parts[0]}${parts[1]}${parts[2]}${parts[3]}-${parts[4]}${parts[5]}-${parts[6]}${parts[7]}-${parts[8]}${parts[9]}-${parts[10]}${parts[11]}${parts[12]}${parts[13]}${parts[14]}${parts[15]}`;
    
    console.log(uuidStr + ":1:1");
}

formatUUID();
