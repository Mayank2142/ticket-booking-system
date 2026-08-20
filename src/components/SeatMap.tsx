"use client";

type SeatCell = {
  seatId: string;
  label: string;
  row: number;
  col: number;
  status: "AVAILABLE" | "HELD" | "BOOKED";
  category: { name: string; color: string };
  heldByMe?: boolean;
};

export function SeatMap({
  rows,
  cols,
  seats,
  selected,
  onToggle,
}: {
  rows: number;
  cols: number;
  seats: SeatCell[];
  selected: string[];
  onToggle: (seatId: string, status: string) => void;
}) {
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      seats.find((s) => s.row === r + 1 && s.col === c + 1)
    )
  );

  function seatStyle(seat: SeatCell, isSelected: boolean) {
    if (isSelected) return { background: "#ffffff", color: "#0f0f0f" };
    if (seat.status === "BOOKED") return { background: "#1a1a1a", color: "rgba(255,255,255,0.3)" };
    if (seat.status === "HELD") return { background: "#3f3f3f", color: "#ffffff", outline: "1px dashed rgba(255,255,255,0.4)" };
    return { background: "#272727", color: "#ffffff" };
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="rounded-full bg-[#1a1a1a] px-4 py-2 text-center text-xs text-white/50">SCREEN</div>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {grid.flat().map((seat, i) => {
            if (!seat) return <div key={i} className="h-8 w-8" />;
            const isSelected = selected.includes(seat.seatId);
            const disabled = seat.status === "BOOKED" || (seat.status === "HELD" && !seat.heldByMe);
            const style = seatStyle(seat, isSelected);

            return (
              <button
                key={seat.seatId}
                title={`${seat.label} · ${seat.category.name}`}
                disabled={disabled}
                onClick={() => onToggle(seat.seatId, seat.status)}
                className="h-8 w-8 rounded-md text-[9px] font-medium disabled:cursor-not-allowed"
                style={{
                  ...style,
                  opacity: disabled && !isSelected ? 0.5 : 1,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                {seat.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-[#272727]" /> Available</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded border border-dashed border-white/40 bg-[#3f3f3f]" /> Held</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-[#1a1a1a]" /> Booked</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded bg-white" /> Selected</span>
      </div>
    </div>
  );
}
