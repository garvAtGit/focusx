public class Test {
    public static void main(String[] args) {
        byte[] uuidBytes = new byte[] {
            (byte)0x87, (byte)0xb9, (byte)0x9b, (byte)0x2c,
            (byte)0x90, (byte)0xfd, (byte)0x11, (byte)0xe9,
            (byte)0xbc, (byte)0x42, (byte)0x52, (byte)0x6a,
            (byte)0xf7, (byte)0x76, (byte)0x4f, (byte)0x64
        };
        String uuidStr = String.format(
            "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
            uuidBytes[0], uuidBytes[1], uuidBytes[2], uuidBytes[3],
            uuidBytes[4], uuidBytes[5], uuidBytes[6], uuidBytes[7],
            uuidBytes[8], uuidBytes[9], uuidBytes[10], uuidBytes[11],
            uuidBytes[12], uuidBytes[13], uuidBytes[14], uuidBytes[15]
        );
        System.out.println(uuidStr + ":1:1");
    }
}
