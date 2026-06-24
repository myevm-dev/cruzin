interface Props {
  onKey: (code: string, down: boolean) => void;
  onToggleCamera: () => void;
}

export default function TouchControls({ onKey, onToggleCamera }: Props) {
  const hold = (code: string) => ({
    onTouchStart: () => onKey(code, true),
    onTouchEnd: () => onKey(code, false),
    onTouchCancel: () => onKey(code, false),
    onMouseDown: () => onKey(code, true),
    onMouseUp: () => onKey(code, false),
    onMouseLeave: () => onKey(code, false),
  });

  return (
    <div className="touch">
      <div className="tbtn gas" {...hold("KeyW")}>
        THR
      </div>

      <div className="tbtn brk" {...hold("KeyS")}>
        SLOW
      </div>

      <div className="tbtn left" {...hold("KeyA")}>
        ←
      </div>

      <div className="tbtn right" {...hold("KeyD")}>
        →
      </div>

      <div className="tbtn pitchUp" {...hold("ArrowDown")}>
        NOSE UP
      </div>

      <div className="tbtn pitchDown" {...hold("ArrowUp")}>
        NOSE DN
      </div>

      <div className="tbtn climb" {...hold("Space")}>
        UP
      </div>

      <div className="tbtn descend" {...hold("ShiftLeft")}>
        DOWN
      </div>

      <div className="tbtn cam" onClick={onToggleCamera}>
        CAM
      </div>
    </div>
  );
}