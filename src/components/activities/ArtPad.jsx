import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Trash2, Minus, Plus, Save, ChevronLeft, Images, Pencil } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const COLOR_GROUPS = [
  { label: 'Reds', colors: ['#7f0000', '#c0392b', '#e74c3c', '#ff6b6b', '#ffb3b3'] },
  { label: 'Oranges', colors: ['#7f3000', '#d35400', '#e67e22', '#f39c12', '#ffd080'] },
  { label: 'Yellows', colors: ['#7a7000', '#b8860b', '#f1c40f', '#f9e547', '#fffacd'] },
  { label: 'Greens', colors: ['#004d00', '#1a7a1a', '#27ae60', '#2ecc71', '#a8f0c0'] },
  { label: 'Blues', colors: ['#00004d', '#1a3a7a', '#2980b9', '#3498db', '#a8d8f0'] },
  { label: 'Purples', colors: ['#3a0050', '#7d3c98', '#9b59b6', '#c39bd3', '#e8d5f0'] },
  { label: 'Pinks', colors: ['#7f0040', '#c0185e', '#e91e8c', '#ff69b4', '#ffc0cb'] },
  { label: 'Neutrals', colors: ['#000000', '#3d3d3d', '#777777', '#bbbbbb', '#ffffff'] },
];

const STORAGE_KEY = 'artpad_saved_artworks';

function getSavedArtworks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export default function ArtPad() {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#1a1a2e');
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [savedArtworks, setSavedArtworks] = useState(getSavedArtworks);
  const [viewingArtwork, setViewingArtwork] = useState(null);
  const [loadedImage, setLoadedImage] = useState(null);   // dataUrl drawn onto canvas when continuing
  const [editingId, setEditingId] = useState(null);       // artwork being edited (save updates it)
  const [pendingDelete, setPendingDelete] = useState(null); // artwork awaiting confirm
  const lastPos = useRef(null);

  useEffect(() => {
    if (showGallery || viewingArtwork) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = 400;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (loadedImage) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = loadedImage;
    }
  }, [showGallery, viewingArtwork, loadedImage]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e) => { e.preventDefault(); setDrawing(true); lastPos.current = getPos(e); };
  const draw = (e) => {
    e.preventDefault();
    if (!drawing) return;
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = isEraser ? lineWidth * 3 : lineWidth;
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };
  const stopDraw = () => setDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setLoadedImage(null);
    setEditingId(null);
  };

  const saveArtwork = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    const date = new Date().toLocaleDateString();
    let updated;
    if (editingId) {
      updated = getSavedArtworks().map(a => (a.id === editingId ? { ...a, dataUrl, date } : a));
    } else {
      const artwork = { id: Date.now(), dataUrl, date };
      updated = [artwork, ...getSavedArtworks()].slice(0, 20); // keep max 20
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedArtworks(updated);
    setEditingId(null);
    setLoadedImage(null);
    alert(editingId ? 'Artwork updated!' : 'Artwork saved!');
  };

  const continueDrawing = (artwork) => {
    setViewingArtwork(null);
    setShowGallery(false);
    setEditingId(artwork.id);
    setLoadedImage(artwork.dataUrl);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const updated = savedArtworks.filter(a => a.id !== pendingDelete.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavedArtworks(updated);
    if (viewingArtwork?.id === pendingDelete.id) setViewingArtwork(null);
    setPendingDelete(null);
  };

  if (viewingArtwork) {
    return (
      <div className="space-y-3 select-none">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setViewingArtwork(null)}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <span className="text-xs text-muted-foreground">{viewingArtwork.date}</span>
        </div>
        <img src={viewingArtwork.dataUrl} alt="Saved artwork" className="w-full rounded-xl border border-border" />
        <Button variant="default" size="sm" className="w-full rounded-xl gap-1.5" onClick={() => continueDrawing(viewingArtwork)}>
          <Pencil className="w-4 h-4" /> Continue drawing
        </Button>
        <Button variant="destructive" size="sm" className="w-full rounded-xl" onClick={() => setPendingDelete(viewingArtwork)}>
          Delete this artwork
        </Button>

        <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this artwork?</AlertDialogTitle>
              <AlertDialogDescription>
                This can't be undone. The artwork will be removed from your gallery.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  if (showGallery) {
    return (
      <div className="space-y-3 select-none">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowGallery(false)}>
            <ChevronLeft className="w-4 h-4" /> Back to canvas
          </Button>
        </div>
        {savedArtworks.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No saved artworks yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {savedArtworks.map(artwork => (
              <div key={artwork.id} className="relative group rounded-xl overflow-hidden border border-border">
                <button onClick={() => setViewingArtwork(artwork)} className="w-full block">
                  <img src={artwork.dataUrl} alt="Artwork" className="w-full aspect-video object-cover" />
                  <p className="text-[10px] text-muted-foreground py-1 text-center">{artwork.date}</p>
                </button>
                <button
                  onClick={() => setPendingDelete(artwork)}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  aria-label="Delete artwork"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this artwork?</AlertDialogTitle>
              <AlertDialogDescription>
                This can't be undone. The artwork will be removed from your gallery.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Yes, delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-3 select-none">
      {/* Canvas */}
      <div className="rounded-xl overflow-hidden border border-border bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none cursor-crosshair"
          style={{ height: 400 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      {/* Colors */}
      <div className="space-y-1">
        {COLOR_GROUPS.map(group => (
          <div key={group.label} className="flex gap-1 justify-center">
            {group.colors.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setIsEraser(false); }}
                className={`w-7 h-7 rounded-md transition-all border border-border/30 ${
                  color === c && !isEraser ? 'ring-2 ring-offset-1 ring-foreground scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Tools */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        <Button
          variant={isEraser ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsEraser(!isEraser)}
          className="gap-1.5 rounded-full"
        >
          <Eraser className="w-3.5 h-3.5" /> Eraser
        </Button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLineWidth(Math.max(1, lineWidth - 1))}>
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs w-6 text-center font-medium">{lineWidth}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLineWidth(Math.min(20, lineWidth + 1))}>
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={clearCanvas} className="gap-1.5 rounded-full">
          <Trash2 className="w-3.5 h-3.5" /> Clear
        </Button>
        <Button variant="outline" size="sm" onClick={saveArtwork} className="gap-1.5 rounded-full">
          <Save className="w-3.5 h-3.5" /> Save
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowGallery(true)} className="gap-1.5 rounded-full">
          <Images className="w-3.5 h-3.5" /> Gallery {savedArtworks.length > 0 && `(${savedArtworks.length})`}
        </Button>
      </div>
    </div>
  );
}