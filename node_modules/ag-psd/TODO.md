- writing 1, 16, 32 bit documents
'pths'
- split decoding layer data from reading the document
- writing paletted documents
- cleanup errors from tests (make list of drawings that should ignore those errors)
- writing zip/zip with prediction


- can we remove sectionDivider property ?
- can we remove nameSource property ?

- improve vector fill / stroke help sections

check: https://github.com/psd-tools/psd-tools
check: https://github.com/TheNicker/libpsd

- zip with prediction: https://github.com/TheNicker/libpsd/blob/master/src/psd_zip.c
- also support saving with zip compression ?







- decompress image data in FEid section

```ts
  if (!channelLength) throw new Error('filterEffect: Empty channel');
  const compression = readUint16(reader);
  const data = createImageDataBitDepth(right - left, bottom - top, depth, 1);
  const end = reader.offset + channelLength - 2;
  readData(reader, channelLength - 2, data, compression, data.width, data.height, depth, 0, false, 1);
  if (reader.offset != end) throw new Error(`Invalid offset after readData ${reader.offset} ${end}`);
  channels.push(data);

  const top = readInt32(reader);
  const left = readInt32(reader);
  const bottom = readInt32(reader);
  const right = readInt32(reader);
  if (readUint32(reader)) throw new Error('filterEffect: 64 bit length is not supported');
  const extraLength = readUint32(reader);
  const compression = readUint16(reader);
  const data = createImageDataBitDepth(right - left, bottom - top, depth, 1);
  readData(reader, extraLength - 2, data, compression, data.width, data.height, depth, 0, false, 1);
  target.filterEffectsMasks[target.filterEffectsMasks.length - 1].extra = { top, left, bottom, right, data };
```

```ts
export function decodeUtf16String(buffer: Uint8Array) {
	let result = '';

	for (let i = 0; i < buffer.byteLength;) {
		const w1 = (buffer[i++] << 8) | buffer[i++];

		if ((w1 & 0xF800) !== 0xD800) { // w1 < 0xD800 || w1 > 0xDFFF
			result += String.fromCharCode(w1);
			continue;
		}

		if ((w1 & 0xFC00) === 0xD800) { // w1 >= 0xD800 && w1 <= 0xDBFF
			throw new Error('Invalid utf-16');
		}

		if (i === buffer.byteLength) {
			throw new Error('Invalid utf-16');
		}

		const w2 = (buffer[i++] << 8) | buffer[i++];

		if ((w2 & 0xFC00) !== 0xDC00) { // w2 < 0xDC00 || w2 > 0xDFFF)
			throw new Error('Invalid utf-16');
		}

		result += String.fromCharCode(((w1 & 0x3ff) << 10) + (w2 & 0x3ff) + 0x10000);
	}

	return result;
}

export function encodeUtf16String(value: string) {
	const buffer = new Uint8Array(value.length * 2);

	for (let i = 0, j = 0; i < value.length; i++, j += 2) {
		const word = value.charCodeAt(i);
		buffer[j] = (word >> 8) & 0xff;
		buffer[j + 1] = word & 0xff;
	}

	return buffer;
}
```
