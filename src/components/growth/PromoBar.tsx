import { Link } from 'react-router-dom';

export default function PromoBar() {
  return (
    <Link to="/shop?sort=newest&utm_source=site&utm_medium=promo_bar&utm_campaign=private_offer" className="group block border-b border-[var(--v33-border)] bg-[#050505] px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-[#d6b58f] transition hover:bg-[#0d0d0e]">
      Private offer: two pieces unlock a quiet privilege. <span className="text-[#fff0e1] group-hover:text-[#d6b58f]">Explore</span>
    </Link>
  );
}
