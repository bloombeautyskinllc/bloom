import { FACE_STROKE, FACE_VIEWBOX, facePaths, type FaceView } from '@/lib/consent/face-maps';

export default function FaceOutline({ view, className }: { view: FaceView; className?: string }) {
  return (
    <svg viewBox={`0 0 ${FACE_VIEWBOX.width} ${FACE_VIEWBOX.height}`} fill="none" aria-hidden="true" className={className}>
      {facePaths[view].map((d) => (
        <path key={d} d={d} stroke={FACE_STROKE} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
