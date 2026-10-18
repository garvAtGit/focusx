export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
): Promise<File | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) return null;

  canvas.width = image.width
  canvas.height = image.height
  ctx.drawImage(image, 0, 0)

  const croppedCanvas = document.createElement('canvas')
  const croppedCtx = croppedCanvas.getContext('2d')

  if (!croppedCtx) return null;

  // Scale down the cropped image to a max dimension of 500px to save payload size
  const MAX_SIZE = 500;
  let scale = 1;
  if (pixelCrop.width > MAX_SIZE || pixelCrop.height > MAX_SIZE) {
    scale = Math.min(MAX_SIZE / pixelCrop.width, MAX_SIZE / pixelCrop.height);
  }

  const finalWidth = Math.round(pixelCrop.width * scale);
  const finalHeight = Math.round(pixelCrop.height * scale);

  croppedCanvas.width = finalWidth
  croppedCanvas.height = finalHeight

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    finalWidth,
    finalHeight
  )

  return new Promise((resolve) => {
    croppedCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "profile-photo.jpeg", { type: "image/jpeg" })
        resolve(file)
      } else {
        resolve(null)
      }
    }, 'image/jpeg', 0.9) // 0.9 quality to compress and avoid payload limits
  })
}
