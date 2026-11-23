"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { IconRotateClockwise, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { petMessages } from "./messages";
import { petFormMessages } from "./form-messages";
import { cropGeometry } from "./crop-geometry";

export function PhotoCropDialog({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: (blob: Blob) => void }) {
  const locale = useLocale(); const t = petFormMessages[locale];
  const dialog = useRef<HTMLDialogElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [zoom, setZoom] = useState(1); const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  useEffect(() => {
    const element = dialog.current!; const focused = document.activeElement as HTMLElement | null;
    element.showModal();
    return () => { element.close(); focused?.focus(); };
  }, []);
  useEffect(() => {
    let active = true; let image: ImageBitmap | null = null;
    createImageBitmap(file).then(value => {
      image = value;
      if (!active) { value.close(); return; }
      if (value.width * value.height > 40000000) { value.close(); setError(t.photoError); return; }
      setBitmap(value);
    }).catch(() => { if (active) setError(t.cropError); });
    return () => { active = false; image?.close(); };
  }, [file, t.photoError, t.cropError]);
  useEffect(() => {
    if (!bitmap || !canvas.current) return;
    const ctx = canvas.current.getContext("2d")!;
    const g = cropGeometry(bitmap.width, bitmap.height, rotation, zoom, position.x, position.y);
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, 256, 256);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, 256, 256);
    ctx.translate(128 + g.dx, 128 + g.dy); ctx.rotate(rotation * Math.PI / 180);
    ctx.scale(g.scale, g.scale); ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  }, [bitmap, zoom, rotation, position]);
  function reset() { setZoom(1); setRotation(0); setPosition({ x: 0, y: 0 }); }
  function save() {
    if (!bitmap || !canvas.current || saving) return;
    setSaving(true);
    canvas.current.toBlob(blob => {
      if (blob) onSave(blob); else { setError(t.cropError); setSaving(false); }
    }, "image/jpeg", .88);
  }
  return <dialog ref={dialog} className="pet-crop-dialog" aria-labelledby="crop-title" aria-describedby="crop-description" onCancel={event => { event.preventDefault(); if (!saving) onCancel(); }}>
    <header><h2 id="crop-title">{t.cropTitle}</h2><button type="button" onClick={onCancel} disabled={saving} aria-label={petMessages[locale].cancel}><IconX size={20} /></button></header>
    <p id="crop-description">{t.cropHint}</p>
    {error ? <p role="alert" className="pet-field-error">{error}</p> : !bitmap ? <p role="status">{t.loading}</p> : null}
    <div className="pet-crop-stage" onPointerDown={event => {
      if (!bitmap) return; event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: event.clientX, y: event.clientY, startX: position.x, startY: position.y };
    }} onPointerMove={event => {
      if (!drag.current || !bitmap) return;
      const g = cropGeometry(bitmap.width, bitmap.height, rotation, zoom, 1, 1);
      const clamp = (v: number) => Math.max(-1, Math.min(1, v));
      setPosition({ x: g.dx ? clamp(drag.current.startX + (event.clientX - drag.current.x) / g.dx) : 0,
        y: g.dy ? clamp(drag.current.startY + (event.clientY - drag.current.y) / g.dy) : 0 });
    }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <canvas ref={canvas} width={512} height={512} aria-label={t.cropTitle} /><div className="pet-crop-circle" aria-hidden="true" />
    </div>
    <div className="pet-crop-tools"><label>{t.zoom}<input type="range" min={1} max={3} step={.01} value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label><Button variant="ghost" size="sm" onClick={() => { setRotation((rotation + 90) % 360); setPosition({ x: 0, y: 0 }); }}><IconRotateClockwise size={16} />{t.rotate}</Button></div>
    <div className="pet-crop-position"><label>{t.horizontal}<input type="range" min={-1} max={1} step={.01} value={position.x} onChange={event => setPosition({ ...position, x: Number(event.target.value) })} /></label><label>{t.vertical}<input type="range" min={-1} max={1} step={.01} value={position.y} onChange={event => setPosition({ ...position, y: Number(event.target.value) })} /></label></div>
    <p className="pet-crop-privacy">{t.cropPrivacy}</p>
    <footer><Button variant="ghost" onClick={onCancel} disabled={saving}>{petMessages[locale].cancel}</Button><Button variant="ghost" onClick={reset} disabled={saving}>{t.reset}</Button><Button onClick={save} disabled={!bitmap || !!error} loading={saving}>{t.savePhoto}</Button></footer>
  </dialog>;
}
