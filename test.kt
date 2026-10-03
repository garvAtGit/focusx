fun main() {
    val appleData = byteArrayOf(
        0x02.toByte(), 0x15.toByte(), 
        0x87.toByte(), 0xb9.toByte(), 0x9b.toByte(), 0x2c.toByte(),
        0x90.toByte(), 0xfd.toByte(), 0x11.toByte(), 0xe9.toByte(),
        0xbc.toByte(), 0x42.toByte(), 0x52.toByte(), 0x6a.toByte(),
        0xf7.toByte(), 0x76.toByte(), 0x4f.toByte(), 0x64.toByte(),
        0x00.toByte(), 0x01.toByte(), 0x00.toByte(), 0x01.toByte()
    )
    val uuidBytes = appleData.copyOfRange(2, 18)
    val uuidStr = String.format(
        "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
        uuidBytes[0], uuidBytes[1], uuidBytes[2], uuidBytes[3],
        uuidBytes[4], uuidBytes[5], uuidBytes[6], uuidBytes[7],
        uuidBytes[8], uuidBytes[9], uuidBytes[10], uuidBytes[11],
        uuidBytes[12], uuidBytes[13], uuidBytes[14], uuidBytes[15]
    )
    val major = ((appleData[18].toInt() and 0xFF) shl 8) or (appleData[19].toInt() and 0xFF)
    val minor = ((appleData[20].toInt() and 0xFF) shl 8) or (appleData[21].toInt() and 0xFF)
    
    val readerId = "$uuidStr:$major:$minor"
    println(readerId)
}
