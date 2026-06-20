type ZipFile = {
    path: string
    content: string
    updatedAt?: Date
}

const textEncoder = new TextEncoder()

const crcTable = Array.from({ length: 256 }, (_, index) => {
    let value = index

    for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }

    return value >>> 0
})

const getCrc32 = (bytes: Uint8Array) => {
    let crc = 0xffffffff

    bytes.forEach((byte) => {
        crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
    })

    return (crc ^ 0xffffffff) >>> 0
}

const getDosDateTime = (date: Date) => {
    const year = Math.max(1980, date.getFullYear())
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
    const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()

    return { dosDate, dosTime }
}

const writeUint16 = (bytes: Uint8Array, offset: number, value: number) => {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >>> 8) & 0xff
}

const writeUint32 = (bytes: Uint8Array, offset: number, value: number) => {
    bytes[offset] = value & 0xff
    bytes[offset + 1] = (value >>> 8) & 0xff
    bytes[offset + 2] = (value >>> 16) & 0xff
    bytes[offset + 3] = (value >>> 24) & 0xff
}

const concatBytes = (parts: Uint8Array[]) => {
    const totalLength = parts.reduce((length, part) => length + part.length, 0)
    const output = new Uint8Array(totalLength)
    let offset = 0

    parts.forEach((part) => {
        output.set(part, offset)
        offset += part.length
    })

    return output
}

export const createZipBlob = (files: ZipFile[]) => {
    const localParts: Uint8Array[] = []
    const centralParts: Uint8Array[] = []
    let offset = 0

    files.forEach((file) => {
        const nameBytes = textEncoder.encode(file.path)
        const contentBytes = textEncoder.encode(file.content)
        const crc32 = getCrc32(contentBytes)
        const { dosDate, dosTime } = getDosDateTime(file.updatedAt ?? new Date())
        const localHeader = new Uint8Array(30 + nameBytes.length)
        const centralHeader = new Uint8Array(46 + nameBytes.length)

        writeUint32(localHeader, 0, 0x04034b50)
        writeUint16(localHeader, 4, 20)
        writeUint16(localHeader, 6, 0x0800)
        writeUint16(localHeader, 8, 0)
        writeUint16(localHeader, 10, dosTime)
        writeUint16(localHeader, 12, dosDate)
        writeUint32(localHeader, 14, crc32)
        writeUint32(localHeader, 18, contentBytes.length)
        writeUint32(localHeader, 22, contentBytes.length)
        writeUint16(localHeader, 26, nameBytes.length)
        localHeader.set(nameBytes, 30)

        writeUint32(centralHeader, 0, 0x02014b50)
        writeUint16(centralHeader, 4, 20)
        writeUint16(centralHeader, 6, 20)
        writeUint16(centralHeader, 8, 0x0800)
        writeUint16(centralHeader, 10, 0)
        writeUint16(centralHeader, 12, dosTime)
        writeUint16(centralHeader, 14, dosDate)
        writeUint32(centralHeader, 16, crc32)
        writeUint32(centralHeader, 20, contentBytes.length)
        writeUint32(centralHeader, 24, contentBytes.length)
        writeUint16(centralHeader, 28, nameBytes.length)
        writeUint32(centralHeader, 42, offset)
        centralHeader.set(nameBytes, 46)

        localParts.push(localHeader, contentBytes)
        centralParts.push(centralHeader)
        offset += localHeader.length + contentBytes.length
    })

    const centralDirectory = concatBytes(centralParts)
    const endRecord = new Uint8Array(22)

    writeUint32(endRecord, 0, 0x06054b50)
    writeUint16(endRecord, 8, files.length)
    writeUint16(endRecord, 10, files.length)
    writeUint32(endRecord, 12, centralDirectory.length)
    writeUint32(endRecord, 16, offset)

    return new Blob([concatBytes([...localParts, centralDirectory, endRecord])], {
        type: 'application/zip',
    })
}
