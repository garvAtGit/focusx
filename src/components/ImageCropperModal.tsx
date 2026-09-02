'use client';
import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@/lib/cropImage';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface Props {
  imageSrc: string;
  onCropDone: (croppedFile: File, croppedUrl: string) => void;
  onCancel: () => void;
}

export function ImageCropperModal({ imageSrc, onCropDone, onCancel }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    if (!croppedAreaPixels) return;
    try {
      setIsCropping(true);
      const croppedImageFile = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImageFile) {
        const url = URL.createObjectURL(croppedImageFile);
        onCropDone(croppedImageFile, url);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCropping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-heading font-bold text-lg">Crop Photo</h2>
          <button onClick={onCancel} className="p-2 bg-muted/50 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative w-full h-[400px] bg-black/10">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={3 / 4} // Standard aspect ratio for the digital pass PFP
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            objectFit="contain"
            cropShape="rect"
            showGrid={true}
          />
        </div>

        {/* Controls */}
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <ZoomOut className="w-5 h-5 text-muted-foreground" />
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <ZoomIn className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" className="flex-1 font-bold" onClick={handleCrop} disabled={isCropping}>
              {isCropping ? "Cropping..." : "Save Photo"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
