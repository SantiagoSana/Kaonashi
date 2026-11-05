import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Price } from '../components/Price';
import { MenuItem, DishCategory } from '../lib/types';
import {
  Search,
  Filter,
  Flame,
  Sparkles,
  AlertTriangle,
  X,
  Plus,
  UtensilsCrossed,
} from 'lucide-react';

export const Menu: React.FC = () => {
  const { t, addToCart, activeCoupon } = useApp();
  const [dishes, setDishes] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);
  const [excludedAllergens, setExcludedAllergens] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'popularity' | 'price_asc' | 'price_desc' | 'spice'>('popularity');
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [allergenWarningDish, setAllergenWarningDish] = useState<MenuItem | null>(null);

  useEffect(() => {
    fetch('/api/menu')
      .then((r) => r.json())
      .then((d) => setDishes(d.items || []))
      .catch(() => {});

    // Track funnel event: menu_view
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: crypto.randomUUID(),
        type: 'menu_view',
        path: '/menu',
        campaignId: activeCoupon?.campaignId,
      }),
    }).catch(() => {});
  }, [activeCoupon]);

  const categories: { id: string; label: string }[] = [
    { id: 'all', label: t('menu.all') },
    { id: 'nigiri', label: t('menu.nigiri') },
    { id: 'sashimi', label: t('menu.sashimi') },
    { id: 'rolls', label: t('menu.rolls') },
    { id: 'omakase', label: t('menu.omakase') },
    { id: 'robata', label: t('menu.robata') },
    { id: 'drinks', label: t('menu.drinks') },
  ];

  // Filtering
  const filteredDishes = dishes.filter((dish) => {
    if (selectedCategory !== 'all' && dish.category !== selectedCategory) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName =
        dish.names.es?.toLowerCase().includes(q) ||
        dish.names.en?.toLowerCase().includes(q) ||
        dish.names.ja?.includes(q) ||
        dish.names.romaji?.toLowerCase().includes(q);
      const matchDesc = dish.descriptions.es?.toLowerCase().includes(q) || dish.descriptions.en?.toLowerCase().includes(q);
      if (!matchName && !matchDesc) return false;
    }
    // Dietary
    if (selectedDietary.length > 0) {
      const hasAll = selectedDietary.every((d) => dish.dietary.includes(d));
      if (!hasAll) return false;
    }
    // Exclude allergens
    if (excludedAllergens.length > 0) {
      const hasExcluded = excludedAllergens.some((a) => dish.allergens.includes(a));
      if (hasExcluded) return false;
    }
    return true;
  });

  // Sorting
  filteredDishes.sort((a, b) => {
    if (sortBy === 'price_asc') return a.price - b.price;
    if (sortBy === 'price_desc') return b.price - a.price;
    if (sortBy === 'spice') return b.spiceLevel - a.spiceLevel;
    return 0;
  });

  const handleAddDish = (dish: MenuItem) => {
    // If dish contains soy and user has soy in excluded or strict alert
    if (dish.allergens.includes('soy') && excludedAllergens.includes('soy')) {
      setAllergenWarningDish(dish);
      return;
    }
    addToCart(dish);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-24 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-bold text-[rgb(var(--text))]">{t('menu.title')}</h1>
        <p className="text-sm text-[rgb(var(--muted))]">{t('menu.subtitle')}</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-3 text-[rgb(var(--muted))]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('menu.searchPlaceholder')}
            className="w-full bg-[rgb(var(--surface))] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:border-[rgb(var(--primary))] focus:outline-none placeholder:text-[rgb(var(--muted))]"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Dietary toggle chips */}
          {['vegan', 'gluten-free'].map((diet) => (
            <button
              key={diet}
              onClick={() =>
                setSelectedDietary((prev) =>
                  prev.includes(diet) ? prev.filter((d) => d !== diet) : [...prev, diet]
                )
              }
              className={`px-3 py-2 text-xs rounded-xl border transition-colors ${
                selectedDietary.includes(diet)
                  ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold border-[rgb(var(--primary))]'
                  : 'bg-[rgb(var(--surface))] border-white/10 text-[rgb(var(--muted))] hover:text-white'
              }`}
            >
              {diet === 'vegan' ? 'Vegan' : 'Gluten-Free'}
            </button>
          ))}

          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-[rgb(var(--surface))] border border-white/10 text-xs text-[rgb(var(--text))] px-3 py-2 rounded-xl focus:outline-none"
          >
            <option value="popularity">{t('menu.popularity')}</option>
            <option value="price_asc">Menor precio</option>
            <option value="price_desc">Mayor precio</option>
            <option value="spice">{t('menu.spice')}</option>
          </select>
        </div>
      </div>

      {/* Sticky Categories Tabs (§6.3) */}
      <div className="sticky top-16 z-20 bg-[rgb(var(--background))]/95 backdrop-blur-md py-2 border-b border-white/5 overflow-x-auto no-scrollbar flex gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat.id
                ? 'bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] shadow-md'
                : 'bg-[rgb(var(--surface))] text-[rgb(var(--muted))] hover:text-white border border-white/5'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Dishes Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {filteredDishes.map((dish) => (
          <div
            key={dish.id}
            className="bg-[rgb(var(--surface))] border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/15 transition-all group"
          >
            <div className="space-y-3 cursor-pointer" onClick={() => setSelectedDish(dish)}>
              {/* Art plate */}
              <div className="h-40 rounded-xl bg-[rgb(var(--background))] border border-white/5 flex items-center justify-center relative overflow-hidden">
                <div
                  className="w-24 h-24 rounded-full border border-white/10 flex flex-col items-center justify-center font-display text-base font-bold text-white/50 shadow-inner"
                  style={{
                    background: `radial-gradient(circle, hsl(${dish.art.hue}, 45%, 22%) 0%, hsl(${dish.art.hue}, 60%, 8%) 100%)`,
                  }}
                >
                  <span>{dish.names.ja?.slice(0, 2)}</span>
                  {dish.names.romaji && (
                    <span className="text-[9px] font-sans font-normal opacity-60 mt-0.5">
                      {dish.names.romaji.slice(0, 10)}
                    </span>
                  )}
                </div>

                {/* Badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {dish.spiceLevel > 0 && (
                    <span className="bg-red-950/80 border border-red-500/40 text-red-400 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Flame size={10} /> {dish.spiceLevel}
                    </span>
                  )}
                  {dish.isRaw && (
                    <span className="bg-blue-950/80 border border-blue-500/40 text-blue-300 text-[10px] px-1.5 py-0.5 rounded">
                      {t('menu.rawBadge')}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-display text-base font-bold text-[rgb(var(--text))] group-hover:text-[rgb(var(--primary))] transition-colors line-clamp-1">
                  {dish.names.es || dish.names.en}
                </h3>
                <p className="text-xs text-[rgb(var(--muted))] line-clamp-2 mt-1">
                  {dish.descriptions.es || dish.descriptions.en}
                </p>
              </div>
            </div>

            {/* Bottom price and add button */}
            <div className="pt-4 border-t border-white/5 mt-4 flex items-center justify-between">
              <Price amountMinor={dish.price} className="text-base font-bold text-[rgb(var(--text))]" />

              {!dish.available ? (
                <span className="text-xs text-[rgb(var(--muted))] border border-white/10 px-2 py-1 rounded">
                  {t('menu.soldOut')}
                </span>
              ) : (
                <button
                  onClick={() => handleAddDish(dish)}
                  className="px-3.5 py-1.5 bg-[rgb(var(--primary))] hover:bg-opacity-90 text-[rgb(var(--on-primary))] font-bold text-xs rounded-lg transition-opacity flex items-center gap-1 shadow"
                >
                  <Plus size={14} />
                  <span>{t('menu.addToCart')}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dish Detail Sheet Modal */}
      {selectedDish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[rgb(var(--surface))] border border-white/10 rounded-2xl max-w-md w-full p-6 space-y-4 relative shadow-2xl">
            <button
              onClick={() => setSelectedDish(null)}
              className="absolute top-4 right-4 p-1.5 text-[rgb(var(--muted))] hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="h-36 rounded-xl bg-[rgb(var(--background))] border border-white/5 flex items-center justify-center">
              <div
                className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center font-display text-xl font-bold text-white/50"
                style={{
                  background: `radial-gradient(circle, hsl(${selectedDish.art.hue}, 45%, 25%) 0%, hsl(${selectedDish.art.hue}, 60%, 10%) 100%)`,
                }}
              >
                {selectedDish.names.ja?.slice(0, 2)}
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-xl font-bold text-[rgb(var(--text))]">
                  {selectedDish.names.es || selectedDish.names.en}
                </h3>
                <Price amountMinor={selectedDish.price} className="text-lg font-bold text-[rgb(var(--primary))]" />
              </div>
              <p className="text-xs text-[rgb(var(--primary))] font-display mt-0.5">
                {selectedDish.names.ja} {selectedDish.names.romaji ? `· ${selectedDish.names.romaji}` : ''}
              </p>
              <p className="text-xs text-[rgb(var(--muted))] mt-2 leading-relaxed">
                {selectedDish.descriptions.es || selectedDish.descriptions.en}
              </p>
            </div>

            {selectedDish.ingredients.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-[rgb(var(--text))] uppercase tracking-wider">
                  {t('menu.ingredients')}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDish.ingredients.map((ing, i) => (
                    <span
                      key={i}
                      className="text-[11px] bg-[rgb(var(--background))] border border-white/5 px-2 py-0.5 rounded text-[rgb(var(--muted))]"
                    >
                      {ing}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedDish.allergens.length > 0 && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-[rgb(var(--text))] uppercase tracking-wider">
                  Alérgenos
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDish.allergens.map((alg, i) => (
                    <span
                      key={i}
                      className="text-[11px] bg-red-950/40 border border-red-500/30 text-red-300 px-2 py-0.5 rounded"
                    >
                      {alg}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  handleAddDish(selectedDish);
                  setSelectedDish(null);
                }}
                className="flex-1 py-3 bg-[rgb(var(--primary))] text-[rgb(var(--on-primary))] font-bold text-sm rounded-xl hover:opacity-90 transition-opacity"
              >
                {t('menu.addToCart')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Soy Allergy Confirmation Dialog (§6.3) */}
      {allergenWarningDish && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[rgb(var(--surface))] border border-[rgb(var(--accent))] rounded-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <AlertTriangle size={36} className="text-[rgb(var(--accent))] mx-auto" />
            <h3 className="font-display text-lg font-bold text-[rgb(var(--text))]">Advertencia de Alérgeno</h3>
            <p className="text-xs text-[rgb(var(--muted))]">{t('menu.soyAllergyConfirm')}</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setAllergenWarningDish(null)}
                className="flex-1 py-2 bg-[rgb(var(--surface))] border border-white/10 text-xs font-semibold rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  addToCart(allergenWarningDish);
                  setAllergenWarningDish(null);
                }}
                className="flex-1 py-2 bg-[rgb(var(--accent))] text-white text-xs font-bold rounded-lg"
              >
                Agregar de todos modos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
