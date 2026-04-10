import { ArrowRight } from "lucide-react";

interface Offer {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  purchase_url: string;
  price: number | null;
  category_tag: string | null;
}

interface Props {
  offer: Offer;
  themeColor: string;
}

export default function BottomPageOffer({ offer, themeColor }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-[11px] uppercase tracking-widest text-gray-400 font-medium">{offer.category_tag || "Recomendado para você"}</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
      <div className="flex flex-col sm:flex-row gap-5 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 cursor-pointer" onClick={() => offer.purchase_url && window.open(offer.purchase_url, "_blank")}>
        {offer.image_url && <img src={offer.image_url} alt={offer.name} className="w-full sm:w-40 h-32 sm:h-28 object-cover rounded-xl flex-shrink-0" />}
        <div className="flex-1 flex flex-col justify-center gap-2 min-w-0">
          <h3 className="text-lg font-semibold text-gray-800 leading-snug">{offer.name}</h3>
          {offer.description && <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{offer.description}</p>}
          <div className="flex items-center justify-between gap-4 mt-1">
            {offer.price != null && offer.price > 0 && <span className="text-base font-semibold text-gray-700">R$ {Number(offer.price).toFixed(2).replace(".", ",")}</span>}
            {offer.purchase_url && <span className="inline-flex items-center gap-1.5 text-sm font-medium hover:gap-2.5 transition-all duration-200" style={{ color: themeColor }}>Saiba mais<ArrowRight className="h-4 w-4" /></span>}
          </div>
        </div>
      </div>
    </div>
  );
}
