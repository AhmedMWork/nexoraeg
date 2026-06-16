import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const rows = [
  ['XS', '48–50 cm', '66 cm', 'Relaxed narrow frame'],
  ['S', '51–53 cm', '68 cm', 'Clean everyday fit'],
  ['M', '54–56 cm', '70 cm', 'Balanced relaxed fit'],
  ['L', '57–59 cm', '72 cm', 'Oversized daily fit'],
  ['XL', '60–62 cm', '74 cm', 'Extra room and drape'],
  ['XXL', '63–65 cm', '76 cm', 'Maximum oversized presence'],
];

export default function SizeGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/70 p-4 backdrop-blur sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="w-full max-w-2xl rounded-[28px] border border-[#202024] bg-[#080808] p-5 shadow-2xl" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-[#c8a96a]">NEXORA fit guide</p>
                <h2 className="mt-2 text-xl font-semibold text-[#f4f0e8]">Choose presence, not guesswork.</h2>
                <p className="mt-2 text-sm leading-6 text-[#8a8175]">Measurements are garment estimates. Compare with a piece you already like for the closest fit.</p>
              </div>
              <button onClick={onClose} className="rounded-full border border-[#202024] p-2 text-[#8a8175] hover:text-[#f4f0e8]" aria-label="Close size guide"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-[#17171a]">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead className="bg-[#111114]"><tr>{['Size','Chest width','Length','Best for'].map((h) => <th key={h} className="p-3 text-[10px] uppercase tracking-[0.18em] text-[#b8b0a3]">{h}</th>)}</tr></thead>
                <tbody>{rows.map((row) => <tr key={row[0]} className="border-t border-[#17171a]">{row.map((cell, i) => <td key={cell} className={`p-3 ${i === 0 ? 'font-semibold text-[#c8a96a]' : 'text-[#b8b0a3]'}`}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
