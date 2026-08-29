import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Search, MessageCircle, Trash2, Plus, Minus, LogOut, Copy,
  X, Store, Lock, Image as ImageIcon, Package, AlertTriangle, Tag,
  Users, ShieldCheck, Phone,
} from "lucide-react";

const NAVY = "#14213D";
const RED = "#E5383B";
const AMBER = "#FFB703";
const GREEN = "#25D366";

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 900;
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function money(n) {
  const num = Number(n) || 0;
  return "₦" + num.toLocaleString("en-NG");
}

function cleanPhone(v) {
  return (v || "").replace(/[^\d]/g, "");
}

function uid(prefix) {
  return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

const CATEGORIES = [
  "Shoes",
  "Textile & Fabrics",
  "Caps & Hats",
  "Bags",
  "Fashion & Clothing",
  "Phones & Electronics",
  "Beauty & Cosmetics",
  "Home & Kitchen",
  "Food & Groceries",
  "Other",
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState([]);
  const [images, setImages] = useState({});
  const [businesses, setBusinesses] = useState([]);
  const [visitors, setVisitors] = useState([]);
  const [adminAuth, setAdminAuth] = useState(null);

  const [visitor, setVisitor] = useState(null);
  const [currentBusiness, setCurrentBusiness] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [view, setView] = useState("buyer");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState(null);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3400);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [bizRes, catRes, visRes, adminRes] = await Promise.all([
          safeGet("businesses", true),
          safeGet("catalog", true),
          safeGet("visitors", true),
          safeGet("platform-admin-auth", true),
        ]);
        const biz = bizRes ? JSON.parse(bizRes.value) : [];
        const cat = catRes ? JSON.parse(catRes.value) : [];
        const vis = visRes ? JSON.parse(visRes.value) : [];
        const admin = adminRes ? JSON.parse(adminRes.value) : null;
        setBusinesses(biz);
        setCatalog(cat);
        setVisitors(vis);
        setAdminAuth(admin);

        const imgMap = {};
        await Promise.all(
          cat.map(async (p) => {
            try {
              const r = Promise.resolve(localStorage.getItem(`img-${p.id}`) ? { value: localStorage.getItem(`img-${p.id}`) } : null);
              if (r) imgMap[p.id] = r.value;
            } catch (e) {
              /* image missing, skip */
            }
          })
        );
        setImages(imgMap);
      } catch (e) {
        showToast("Couldn't load the marketplace. Try refreshing.");
      }
      setLoading(false);
    })();
  }, [showToast]);

  const imagesRef = useRef({});
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Keep the buyer's view current: re-check stock every 15s so items
  // that just sold out disappear and the next available ones take their place.
  useEffect(() => {
    if (view !== "buyer" || currentBusiness || isAdmin) return;
    const interval = setInterval(async () => {
      try {
        const catRes = await safeGet("catalog", true);
        if (!catRes) return;
        const cat = JSON.parse(catRes.value);
        setCatalog(cat);
        const missing = cat.filter((p) => !imagesRef.current[p.id]);
        if (missing.length) {
          const updates = {};
          await Promise.all(
            missing.map(async (p) => {
              try {
                const r = Promise.resolve(localStorage.getItem(`img-${p.id}`) ? { value: localStorage.getItem(`img-${p.id}`) } : null);
                if (r) updates[p.id] = r.value;
              } catch (e) {
                /* skip */
              }
            })
          );
          if (Object.keys(updates).length) setImages((prev) => ({ ...prev, ...updates }));
        }
      } catch (e) {
        /* silent — keep showing last known catalog */
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [view, currentBusiness, isAdmin]);

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  function handleCategoryChange(cat) {
    setCategoryFilter(cat);
    setPage(1);
  }

  async function safeGet(key, shared) {
    try {
      return Promise.resolve(localStorage.getItem(key) ? { value: localStorage.getItem(key) } : null);
    } catch (e) {
      return null;
    }
  }

  async function saveCatalog(next) {
    setCatalog(next);
    try {
      const res = Promise.resolve(localStorage.setItem("catalog", JSON.stringify(next)));
      if (!res) showToast("Change may not have saved — check your connection.");
    } catch (e) {
      showToast("Change may not have saved — check your connection.");
    }
  }

  async function saveBusinesses(next) {
    setBusinesses(next);
    try {
      Promise.resolve(localStorage.setItem("businesses", JSON.stringify(next)));
    } catch (e) {
      showToast("Change may not have saved — check your connection.");
    }
  }

  async function saveVisitors(next) {
    setVisitors(next);
    try {
      Promise.resolve(localStorage.setItem("visitors", JSON.stringify(next)));
    } catch (e) {
      /* best effort — don't block browsing on this */
    }
  }

  // ---- Visitor gate ----
  async function enterStore(phoneRaw) {
    const phone = cleanPhone(phoneRaw);
    if (phone.length < 10) {
      showToast("Enter a valid WhatsApp number to continue.");
      return;
    }
    const now = Date.now();
    const existing = visitors.find((v) => v.whatsapp === phone);
    let next;
    if (existing) {
      next = visitors.map((v) => (v.whatsapp === phone ? { ...v, lastVisit: now, visits: v.visits + 1 } : v));
    } else {
      next = [...visitors, { whatsapp: phone, firstVisit: now, lastVisit: now, visits: 1 }];
    }
    await saveVisitors(next);
    setVisitor(phone);
  }

  // ---- Bulk upload ----
  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const newDrafts = [];
    for (const f of files) {
      if (!f.type || !f.type.startsWith("image/")) continue;
      try {
        const dataUrl = await resizeImage(f);
        newDrafts.push({
          tempId: uid("d"),
          dataUrl,
          name: "",
          category: "",
          originalPrice: "",
          discountPrice: "",
          qty: "1",
        });
      } catch (e) {
        /* skip file that failed to read */
      }
    }
    if (newDrafts.length) setDrafts((prev) => [...prev, ...newDrafts]);
    else showToast("Those files couldn't be read as images.");
  }

  function updateDraft(tempId, field, value) {
    setDrafts((prev) => prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d)));
  }

  function removeDraft(tempId) {
    setDrafts((prev) => prev.filter((d) => d.tempId !== tempId));
  }

  async function publishDrafts() {
    if (!currentBusiness) return;
    const invalid = drafts.some(
      (d) => !d.name.trim() || !d.discountPrice || Number(d.discountPrice) <= 0 || !d.qty || Number(d.qty) < 1
    );
    if (invalid) {
      showToast("Add a name, discount price and a quantity of at least 1 for every photo first.");
      return;
    }
    setPublishing(true);
    try {
      const newProducts = [];
      for (const d of drafts) {
        const id = uid("p");
        Promise.resolve(localStorage.setItem(`img-${id}`, d.dataUrl));
        newProducts.push({
          id,
          sellerId: currentBusiness.id,
          name: d.name.trim(),
          category: d.category.trim(),
          originalPrice: Number(d.originalPrice) || Number(d.discountPrice),
          discountPrice: Number(d.discountPrice),
          qty: Math.max(1, Math.round(Number(d.qty))),
          createdAt: Date.now(),
        });
      }
      const merged = [...newProducts, ...catalog];
      localStorage.setItem("catalog", JSON.stringify(merged));
      setCatalog(merged);
      setImages((prev) => {
        const copy = { ...prev };
        newProducts.forEach((p, i) => {
          copy[p.id] = drafts[i].dataUrl;
        });
        return copy;
      });
      setDrafts([]);
      showToast(`Published ${newProducts.length} product${newProducts.length > 1 ? "s" : ""}.`);
    } catch (e) {
      showToast("Couldn't publish right now. Try again.");
    }
    setPublishing(false);
  }

  function editField(id, field, value) {
    setCatalog((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  async function commitField(id, field, rawValue) {
    const num = Math.max(0, Number(rawValue) || 0);
    const next = catalog.map((p) => (p.id === id ? { ...p, [field]: num } : p));
    await saveCatalog(next);
  }

  async function persistCatalog() {
    await saveCatalog(catalog);
  }

  async function removeProduct(id, opts) {
    const product = catalog.find((p) => p.id === id);
    if (!product) return;
    const next = catalog.filter((p) => p.id !== id);
    await saveCatalog(next);
    try {
      Promise.resolve(localStorage.removeItem(`img-${id}`));
    } catch (e) {
      /* image cleanup best-effort */
    }
    if (!opts || !opts.silent) showToast("Product removed.");
  }

  async function adjustQty(id, delta) {
    const product = catalog.find((p) => p.id === id);
    if (!product) return;
    const nextQty = product.qty + delta;
    if (nextQty <= 0) {
      await removeProduct(id, { silent: true });
      showToast(`"${product.name}" sold out and was removed from your store.`);
      return;
    }
    const next = catalog.map((p) => (p.id === id ? { ...p, qty: nextQty } : p));
    await saveCatalog(next);
    if (delta < 0) showToast(`${product.name}: stock updated to ${nextQty}.`);
  }

  async function deleteProduct(id) {
    const product = catalog.find((p) => p.id === id);
    if (!product) return;
    if (!window.confirm(`Remove "${product.name}" from your store?`)) return;
    await removeProduct(id);
  }

  async function copyBroadcast() {
    if (!currentBusiness) return;
    const mine = catalog.filter((p) => p.sellerId === currentBusiness.id);
    if (!mine.length) {
      showToast("Nothing in stock to share yet.");
      return;
    }
    const header = `*${currentBusiness.businessName} — today's deals*\n`;
    const lines = mine.map((p) => {
      const pct =
        p.originalPrice > p.discountPrice
          ? ` (${Math.round((1 - p.discountPrice / p.originalPrice) * 100)}% off)`
          : "";
      return `• ${p.name} — ${money(p.discountPrice)}${pct} — ${p.qty} left`;
    });
    const footer = `\nMessage us on WhatsApp to grab yours before it's gone!`;
    const text = header + lines.join("\n") + footer;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Broadcast message copied — paste it into your WhatsApp group.");
    } catch (e) {
      showToast("Couldn't copy automatically. Select the text manually.");
    }
  }

  function whatsappLinkForProduct(product, business) {
    const number = cleanPhone(business?.whatsapp);
    const msg =
      `Hi ${business?.businessName || "there"}! I'm interested in "${product.name}" ` +
      `for ${money(product.discountPrice)} (was ${money(product.originalPrice)}). ` +
      `Please confirm it's still available. I'd like to buy: ___ unit(s).`;
    return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
  }

  function whatsappLinkPlain(number, text) {
    return `https://wa.me/${cleanPhone(number)}?text=${encodeURIComponent(text)}`;
  }

  // ---- Business auth ----
  async function registerBusiness({ businessName, whatsapp, password, category }) {
    if (!businessName.trim() || !whatsapp.trim() || !password || !category) {
      showToast("Fill in every field, including a category, to register your business.");
      return;
    }
    const phone = cleanPhone(whatsapp);
    if (businesses.some((b) => b.whatsapp === phone)) {
      showToast("That WhatsApp number is already registered — log in instead.");
      return;
    }
    const biz = { id: uid("b"), businessName: businessName.trim(), whatsapp: phone, password, category, createdAt: Date.now() };
    const next = [...businesses, biz];
    try {
      Promise.resolve(localStorage.setItem("businesses", JSON.stringify(next)));
      setBusinesses(next);
      setCurrentBusiness(biz);
      setView("seller");
      setModal(null);
      showToast(`Welcome to Slasha, ${biz.businessName}!`);
    } catch (e) {
      showToast("Couldn't register right now. Try again.");
    }
  }

  function loginBusiness({ whatsapp, password }) {
    const phone = cleanPhone(whatsapp);
    const biz = businesses.find((b) => b.whatsapp === phone && b.password === password);
    if (!biz) {
      showToast("No match found. Check your WhatsApp number and password.");
      return;
    }
    setCurrentBusiness(biz);
    setView("seller");
    setModal(null);
  }

  function sellerLogout() {
    setCurrentBusiness(null);
    setView("buyer");
  }

  // ---- Platform admin ----
  async function setupAdmin(password) {
    if (!password) {
      showToast("Choose a password first.");
      return;
    }
    const auth = { password, createdAt: Date.now() };
    try {
      Promise.resolve(localStorage.setItem("platform-admin-auth", JSON.stringify(auth)));
      setAdminAuth(auth);
      setIsAdmin(true);
      setView("admin");
      setModal(null);
    } catch (e) {
      showToast("Couldn't set up admin access. Try again.");
    }
  }

  function loginAdmin(password) {
    if (adminAuth && password === adminAuth.password) {
      setIsAdmin(true);
      setView("admin");
      setModal(null);
    } else {
      showToast("Wrong password.");
    }
  }

  function adminLogout() {
    setIsAdmin(false);
    setView("buyer");
  }

  async function removeBusiness(id) {
    const biz = businesses.find((b) => b.id === id);
    if (!biz) return;
    if (!window.confirm(`Remove "${biz.businessName}" and delist all of their products?`)) return;
    const theirProducts = catalog.filter((p) => p.sellerId === id);
    const nextCatalog = catalog.filter((p) => p.sellerId !== id);
    const nextBiz = businesses.filter((b) => b.id !== id);
    await saveCatalog(nextCatalog);
    await saveBusinesses(nextBiz);
    await Promise.all(
      theirProducts.map((p) => Promise.resolve(localStorage.removeItem(`img-${p.id}`)).catch(() => {}))
    );
    showToast(`${biz.businessName} removed.`);
  }

  const businessMap = {};
  businesses.forEach((b) => (businessMap[b.id] = b));

  const activeCategories = Array.from(
    new Set(businesses.map((b) => b.category).filter(Boolean))
  );

  const filtered = catalog.filter((p) => {
    const biz = businessMap[p.sellerId];
    if (categoryFilter && biz?.category !== categoryFilter) return false;
    const bizName = biz?.businessName || "";
    return (p.name + " " + p.category + " " + bizName).toLowerCase().includes(search.toLowerCase());
  });

  const myCatalog = currentBusiness ? catalog.filter((p) => p.sellerId === currentBusiness.id) : [];
  const lowStockCount = myCatalog.filter((p) => p.qty > 0 && p.qty <= 3).length;

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#F5F6FA", fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        .slasha-display { font-family: 'Poppins', system-ui, sans-serif; }
      `}</style>

      <header style={{ background: NAVY }} className="sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setView("buyer")}
            className="flex items-center gap-2 shrink-0"
          >
            <div style={{ background: AMBER }} className="w-9 h-9 rounded-xl flex items-center justify-center rotate-[-6deg]">
              <Tag size={18} color={NAVY} strokeWidth={2.5} />
            </div>
            <span className="slasha-display text-white text-xl font-bold tracking-tight">Slasha</span>
          </button>

          {view === "buyer" && visitor && (
            <div className="flex-1 max-w-md ml-2">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search products or stores..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white/95 outline-none focus:ring-2"
                  style={{ "--tw-ring-color": AMBER }}
                />
              </div>
            </div>
          )}

          <div className="flex-1" />

          {currentBusiness ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setView(view === "seller" ? "buyer" : "seller")}
                className="text-sm font-semibold px-3 py-2 rounded-lg text-white border border-white/25 hover:bg-white/10"
              >
                {view === "seller" ? "View marketplace" : "My dashboard"}
              </button>
              <button
                onClick={sellerLogout}
                title="Log out"
                className="text-sm font-semibold px-3 py-2 rounded-lg text-white border border-white/25 hover:bg-white/10 flex items-center gap-1"
              >
                <LogOut size={15} /> <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          ) : isAdmin ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setView(view === "admin" ? "buyer" : "admin")}
                className="text-sm font-semibold px-3 py-2 rounded-lg text-white border border-white/25 hover:bg-white/10"
              >
                {view === "admin" ? "View marketplace" : "Admin panel"}
              </button>
              <button
                onClick={adminLogout}
                className="text-sm font-semibold px-3 py-2 rounded-lg text-white border border-white/25 hover:bg-white/10 flex items-center gap-1"
              >
                <LogOut size={15} /> <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setModal("business-auth")}
              className="text-sm font-semibold px-3 py-2 rounded-lg shrink-0"
              style={{ background: AMBER, color: NAVY }}
            >
              Post your products
            </button>
          )}
        </div>
        {currentBusiness && (
          <div className="max-w-6xl mx-auto px-4 pb-2 -mt-1 hidden sm:block">
            <span className="text-white/60 text-xs">{currentBusiness.businessName}'s dashboard</span>
          </div>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400 text-sm">Loading marketplace…</div>
      ) : view === "seller" && currentBusiness ? (
        <SellerDashboard
          catalog={myCatalog}
          images={images}
          drafts={drafts}
          publishing={publishing}
          lowStockCount={lowStockCount}
          fileInputRef={fileInputRef}
          onFiles={handleFiles}
          onUpdateDraft={updateDraft}
          onRemoveDraft={removeDraft}
          onPublish={publishDrafts}
          onEditField={editField}
          onCommitField={commitField}
          onAdjustQty={adjustQty}
          onDelete={deleteProduct}
          onCopyBroadcast={copyBroadcast}
          onPersist={persistCatalog}
        />
      ) : view === "admin" && isAdmin ? (
        <AdminDashboard
          visitors={visitors}
          businesses={businesses}
          catalog={catalog}
          whatsappLinkPlain={whatsappLinkPlain}
          onRemoveBusiness={removeBusiness}
        />
      ) : !visitor ? (
        <VisitorGate onEnter={enterStore} />
      ) : (
        <BuyerView
          products={filtered}
          images={images}
          businessMap={businessMap}
          whatsappLink={whatsappLinkForProduct}
          searchActive={!!search}
          page={page}
          setPage={setPage}
          categories={activeCategories}
          categoryFilter={categoryFilter}
          onCategoryChange={handleCategoryChange}
        />
      )}

      <footer className="text-center py-6">
        <button
          onClick={() => setModal(adminAuth ? "admin-login" : "admin-setup")}
          className="text-[11px] text-gray-400 hover:text-gray-500 underline"
        >
          Platform admin
        </button>
      </footer>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#14213D] text-white text-sm px-4 py-2.5 rounded-lg shadow-lg max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      {modal === "business-auth" && (
        <BusinessAuthModal onClose={() => setModal(null)} onRegister={registerBusiness} onLogin={loginBusiness} />
      )}
      {modal === "admin-setup" && <AdminSetupModal onClose={() => setModal(null)} onSubmit={setupAdmin} />}
      {modal === "admin-login" && <AdminLoginModal onClose={() => setModal(null)} onSubmit={loginAdmin} />}
    </div>
  );
}

function VisitorGate({ onEnter }) {
  const [phone, setPhone] = useState("");
  return (
    <div className="max-w-sm mx-auto text-center py-16 px-6">
      <div style={{ background: AMBER }} className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-[-6deg]">
        <Phone size={24} color={NAVY} />
      </div>
      <h2 className="slasha-display text-lg font-bold text-gray-800 mb-2">Enter your WhatsApp number</h2>
      <p className="text-sm text-gray-500 mb-5">
        No account or password needed — just your WhatsApp number, so sellers can reply to you when you buy.
      </p>
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter(phone)}
        placeholder="e.g. 2348012345678"
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-3 outline-none focus:border-gray-500 text-center"
      />
      <button
        onClick={() => onEnter(phone)}
        style={{ background: GREEN }}
        className="w-full py-2.5 rounded-lg text-white font-semibold text-sm"
      >
        View products
      </button>
    </div>
  );
}

const PAGE_SIZE = 10;

function BuyerView({
  products, images, businessMap, whatsappLink, searchActive,
  page, setPage, categories, categoryFilter, onCategoryChange,
}) {
  const categoryBar = categories && categories.length > 0 && (
    <div className="max-w-6xl mx-auto px-4 pt-4 flex flex-wrap gap-2">
      <button
        onClick={() => onCategoryChange(null)}
        className="text-xs font-semibold px-3 py-1.5 rounded-full border"
        style={
          !categoryFilter
            ? { background: NAVY, color: "white", borderColor: NAVY }
            : { background: "white", color: "#4B5563", borderColor: "#D1D5DB" }
        }
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onCategoryChange(c)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border"
          style={
            categoryFilter === c
              ? { background: NAVY, color: "white", borderColor: NAVY }
              : { background: "white", color: "#4B5563", borderColor: "#D1D5DB" }
          }
        >
          {c}
        </button>
      ))}
    </div>
  );

  if (products.length === 0) {
    return (
      <>
        {categoryBar}
        <div className="max-w-md mx-auto text-center py-24 px-6">
          <Package size={40} className="mx-auto mb-4 text-gray-300" />
          <h2 className="slasha-display text-lg font-bold text-gray-700 mb-2">
            {searchActive || categoryFilter ? "No matches" : "No products yet"}
          </h2>
          <p className="text-sm text-gray-500">
            {searchActive || categoryFilter ? "Try a different search or category." : "Check back soon — sellers are stocking up."}
          </p>
        </div>
      </>
    );
  }

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageProducts = products.slice(start, start + PAGE_SIZE);

  return (
    <>
      {categoryBar}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {pageProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              image={images[p.id]}
              business={businessMap[p.sellerId]}
              whatsappLink={whatsappLink}
            />
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-300 bg-white disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, products.length)} of {products.length}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-gray-300 bg-white disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
        <p className="text-center text-[11px] text-gray-400 mt-3">
          Stock updates automatically — sold-out items are replaced by what's still available.
        </p>
      </div>
    </>
  );
}

function ProductCard({ product, image, business, whatsappLink }) {
  const pct =
    product.originalPrice > product.discountPrice
      ? Math.round((1 - product.discountPrice / product.originalPrice) * 100)
      : 0;

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col">
      <div className="relative aspect-square bg-gray-100">
        {image ? (
          <img src={image} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <ImageIcon size={32} />
          </div>
        )}
        {pct > 0 && (
          <span style={{ background: AMBER, color: NAVY }} className="absolute top-2 right-2 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
            -{pct}%
          </span>
        )}
        <span
          style={{ background: RED }}
          className="absolute -left-1 top-3 text-white text-sm font-extrabold pl-3 pr-3 py-1 rounded-r-full shadow rotate-[-3deg] slasha-display"
        >
          {money(product.discountPrice)}
        </span>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        {business && <p className="text-[11px] text-gray-400 mb-0.5 truncate">{business.businessName}</p>}
        <p className="font-semibold text-sm text-gray-800 leading-snug line-clamp-2">{product.name}</p>
        <div className="flex items-center gap-2 mt-1">
          {product.originalPrice > product.discountPrice && (
            <span className="text-xs text-gray-400 line-through">{money(product.originalPrice)}</span>
          )}
          <span className={`text-xs font-medium ${product.qty <= 3 ? "text-amber-600" : "text-gray-500"}`}>
            {product.qty <= 3 ? `Only ${product.qty} left` : `${product.qty} in stock`}
          </span>
        </div>
      </div>

      <a
        href={whatsappLink(product, business)}
        target="_blank"
        rel="noopener noreferrer"
        style={{ background: GREEN }}
        className="mx-3 mb-3 py-2 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 hover:brightness-95"
      >
        <MessageCircle size={16} /> Buy on WhatsApp
      </a>
    </div>
  );
}

function SellerDashboard(props) {
  const {
    catalog, images, drafts, publishing, lowStockCount, fileInputRef,
    onFiles, onUpdateDraft, onRemoveDraft, onPublish, onEditField, onCommitField,
    onAdjustQty, onDelete, onCopyBroadcast, onPersist,
  } = props;

  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard icon={<Package size={16} />} label="Products live" value={catalog.length} />
        <StatCard icon={<AlertTriangle size={16} />} label="Low stock" value={lowStockCount} tone="amber" />
      </div>

      <p className="text-xs text-gray-500 mb-4 bg-gray-100 rounded-lg px-3 py-2">
        Products sell out automatically — once a quantity hits zero, it's removed from your storefront right away.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition mb-6 ${
          dragOver ? "border-[#E5383B] bg-red-50" : "border-gray-300 bg-white hover:bg-gray-50"
        }`}
      >
        <Upload size={28} className="mx-auto mb-2 text-gray-400" />
        <p className="font-semibold text-gray-700 slasha-display">Bulk upload photos</p>
        <p className="text-sm text-gray-500 mt-1">
          Drop as many product photos here as you like, or click to choose files. Add price and quantity for each next.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {drafts.length > 0 && (
        <div className="mb-8 bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="slasha-display font-bold text-gray-800">
              {drafts.length} photo{drafts.length > 1 ? "s" : ""} ready — add details
            </h3>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {drafts.map((d) => (
              <DraftCard key={d.tempId} draft={d} onUpdate={onUpdateDraft} onRemove={onRemoveDraft} />
            ))}
          </div>
          <button
            onClick={onPublish}
            disabled={publishing}
            style={{ background: RED }}
            className="mt-4 w-full sm:w-auto px-5 py-2.5 rounded-lg text-white font-semibold text-sm disabled:opacity-60"
          >
            {publishing ? "Publishing…" : `Publish ${drafts.length} product${drafts.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h3 className="slasha-display font-bold text-gray-800">Your products</h3>
        <button
          onClick={onCopyBroadcast}
          className="text-sm font-semibold px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 flex items-center gap-2"
        >
          <Copy size={14} /> Copy WhatsApp broadcast
        </button>
      </div>

      {catalog.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">No products yet — bulk upload some photos above to get started.</p>
      ) : (
        <div className="space-y-2">
          {catalog.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              image={images[p.id]}
              onEditField={onEditField}
              onCommitField={onCommitField}
              onAdjustQty={onAdjustQty}
              onDelete={onDelete}
              onPersist={onPersist}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tone }) {
  const bg = tone === "amber" ? "#FFF7E6" : "#F5F6FA";
  const fg = tone === "amber" ? "#B45309" : NAVY;
  return (
    <div className="rounded-xl p-3" style={{ background: bg }}>
      <div className="flex items-center gap-1.5 text-xs font-medium mb-1" style={{ color: fg }}>
        {icon} {label}
      </div>
      <div className="text-xl font-bold slasha-display" style={{ color: fg }}>
        {value}
      </div>
    </div>
  );
}

function DraftCard({ draft, onUpdate, onRemove }) {
  return (
    <div className="border border-gray-200 rounded-xl p-2.5 relative">
      <button onClick={() => onRemove(draft.tempId)} className="absolute top-1.5 right-1.5 bg-white/90 rounded-full p-1 border border-gray-200">
        <X size={12} />
      </button>
      <img src={draft.dataUrl} alt="" className="w-full aspect-square object-cover rounded-lg mb-2" />
      <input
        placeholder="Product name"
        value={draft.name}
        onChange={(e) => onUpdate(draft.tempId, "name", e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 mb-1.5 outline-none focus:border-gray-400"
      />
      <input
        placeholder="Category (optional)"
        value={draft.category}
        onChange={(e) => onUpdate(draft.tempId, "category", e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 mb-1.5 outline-none focus:border-gray-400"
      />
      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
        <div>
          <label className="text-[11px] text-gray-400">Original price</label>
          <input
            type="number"
            min="0"
            placeholder="₦"
            value={draft.originalPrice}
            onChange={(e) => onUpdate(draft.tempId, "originalPrice", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-gray-400"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-400">Discount price</label>
          <input
            type="number"
            min="0"
            placeholder="₦"
            value={draft.discountPrice}
            onChange={(e) => onUpdate(draft.tempId, "discountPrice", e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-gray-400"
          />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-gray-400">Quantity available</label>
        <input
          type="number"
          min="1"
          value={draft.qty}
          onChange={(e) => onUpdate(draft.tempId, "qty", e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-gray-400"
        />
      </div>
    </div>
  );
}

function ProductRow({ product, image, onEditField, onCommitField, onAdjustQty, onDelete, onPersist }) {
  const low = product.qty > 0 && product.qty <= 3;
  const rowBg = low ? "bg-amber-50" : "bg-white";

  return (
    <div className={`${rowBg} border border-gray-200 rounded-xl p-2.5 flex flex-wrap sm:flex-nowrap items-center gap-3`}>
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
        {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : null}
      </div>

      <input
        value={product.name}
        onChange={(e) => onEditField(product.id, "name", e.target.value)}
        onBlur={onPersist}
        className="text-sm font-semibold border-b border-transparent hover:border-gray-200 focus:border-gray-400 outline-none flex-1 min-w-[120px] bg-transparent"
      />

      <div className="flex items-center gap-1">
        <label className="text-[11px] text-gray-400">Orig.</label>
        <input
          type="number"
          min="0"
          value={product.originalPrice}
          onChange={(e) => onEditField(product.id, "originalPrice", e.target.value)}
          onBlur={(e) => onCommitField(product.id, "originalPrice", e.target.value)}
          className="w-20 text-sm border border-gray-200 rounded-md px-1.5 py-1 outline-none focus:border-gray-400"
        />
      </div>

      <div className="flex items-center gap-1">
        <label className="text-[11px]" style={{ color: RED }}>Sale</label>
        <input
          type="number"
          min="0"
          value={product.discountPrice}
          onChange={(e) => onEditField(product.id, "discountPrice", e.target.value)}
          onBlur={(e) => onCommitField(product.id, "discountPrice", e.target.value)}
          className="w-20 text-sm border rounded-md px-1.5 py-1 outline-none font-semibold"
          style={{ borderColor: "#F3B7B7", color: RED }}
        />
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <button onClick={() => onAdjustQty(product.id, -1)} className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-100">
          <Minus size={13} />
        </button>
        <span className={`w-8 text-center text-sm font-semibold ${low ? "text-amber-600" : "text-gray-700"}`}>{product.qty}</span>
        <button onClick={() => onAdjustQty(product.id, 1)} className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center hover:bg-gray-100">
          <Plus size={13} />
        </button>
      </div>

      <button onClick={() => onDelete(product.id)} className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0" title="Remove product">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function AdminDashboard({ visitors, businesses, catalog, whatsappLinkPlain, onRemoveBusiness }) {
  const [tab, setTab] = useState("visitors");
  const sortedVisitors = [...visitors].sort((a, b) => b.lastVisit - a.lastVisit);
  const sortedBusinesses = [...businesses].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={18} style={{ color: NAVY }} />
        <h2 className="slasha-display font-bold text-gray-800 text-lg">Platform admin</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">Monitor everyone who visits your marketplace and every business selling on it.</p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("visitors")}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === "visitors" ? "text-white" : "bg-white border border-gray-300 text-gray-600"}`}
          style={tab === "visitors" ? { background: NAVY } : {}}
        >
          Visitors ({visitors.length})
        </button>
        <button
          onClick={() => setTab("businesses")}
          className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === "businesses" ? "text-white" : "bg-white border border-gray-300 text-gray-600"}`}
          style={tab === "businesses" ? { background: NAVY } : {}}
        >
          Businesses ({businesses.length})
        </button>
      </div>

      {tab === "visitors" ? (
        sortedVisitors.length === 0 ? (
          <EmptyAdmin icon={<Users size={32} />} text="No visitors have entered the marketplace yet." />
        ) : (
          <div className="space-y-2">
            {sortedVisitors.map((v) => (
              <div key={v.whatsapp} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Phone size={15} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{v.whatsapp}</p>
                  <p className="text-xs text-gray-500">
                    {v.visits} visit{v.visits > 1 ? "s" : ""} · first {fmtDate(v.firstVisit)} · last {fmtDate(v.lastVisit)}
                  </p>
                </div>
                <a
                  href={whatsappLinkPlain(v.whatsapp, "Hi! Thanks for checking out Slasha — let us know if you need help finding a deal.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: GREEN }}
                  className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0"
                >
                  <MessageCircle size={13} /> Message
                </a>
              </div>
            ))}
          </div>
        )
      ) : sortedBusinesses.length === 0 ? (
        <EmptyAdmin icon={<Store size={32} />} text="No businesses have registered yet." />
      ) : (
        <div className="space-y-2">
          {sortedBusinesses.map((b) => {
            const count = catalog.filter((p) => p.sellerId === b.id).length;
            return (
              <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Store size={15} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{b.businessName}</p>
                  <p className="text-xs text-gray-500">
                    {b.whatsapp} · {count} product{count === 1 ? "" : "s"} live · joined {fmtDate(b.createdAt)}
                  </p>
                </div>
                <a
                  href={whatsappLinkPlain(b.whatsapp, `Hi ${b.businessName}, this is the Slasha team reaching out.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: GREEN }}
                  className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0"
                >
                  <MessageCircle size={13} /> Message
                </a>
                <button
                  onClick={() => onRemoveBusiness(b.id)}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                  title="Remove business"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyAdmin({ icon, text }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <div className="mx-auto mb-3">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function BusinessAuthModal({ onClose, onRegister, onLogin }) {
  const [tab, setTab] = useState("register");
  const [businessName, setBusinessName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("");

  return (
    <ModalShell onClose={onClose} title="Post your products" icon={<Store size={18} />}>
      <p className="text-sm text-gray-500 mb-4">
        Thousands of Nigerians visit and see your products every day. Register your business to post photos and start getting orders on WhatsApp.
      </p>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("register")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${tab === "register" ? "text-white" : "bg-gray-100 text-gray-600"}`}
          style={tab === "register" ? { background: RED } : {}}
        >
          Register
        </button>
        <button
          onClick={() => setTab("login")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${tab === "login" ? "text-white" : "bg-gray-100 text-gray-600"}`}
          style={tab === "login" ? { background: RED } : {}}
        >
          Log in
        </button>
      </div>

      {tab === "register" && (
        <FieldLabel>Business name</FieldLabel>
      )}
      {tab === "register" && (
        <input
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Ada's Fashion Hub"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-gray-500"
        />
      )}

      <FieldLabel>WhatsApp number (with country code)</FieldLabel>
      <input
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        placeholder="e.g. 2348012345678"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-gray-500"
      />
      <FieldLabel>Password</FieldLabel>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={tab === "register" ? "Create a password" : "Your password"}
        onKeyDown={(e) =>
          e.key === "Enter" &&
          (tab === "register" ? onRegister({ businessName, whatsapp, password, category }) : onLogin({ whatsapp, password }))
        }
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-gray-500"
      />
      {tab === "register" && (
        <>
          <FieldLabel>Business category</FieldLabel>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-gray-500"
          >
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </>
      )}

      {tab === "register" && (
        <p className="text-xs text-gray-400 mb-3">
          This marketplace stores your details to run your store, and your product list is visible to every visitor.
        </p>
      )}
      <button
        onClick={() =>
          tab === "register" ? onRegister({ businessName, whatsapp, password, category }) : onLogin({ whatsapp, password })
        }
        style={{ background: RED }}
        className="w-full py-2.5 rounded-lg text-white font-semibold text-sm"
      >
        {tab === "register" ? "Create my store" : "Log in"}
      </button>
    </ModalShell>
  );
}

function AdminSetupModal({ onClose, onSubmit }) {
  const [password, setPassword] = useState("");
  return (
    <ModalShell onClose={onClose} title="Set up admin access" icon={<ShieldCheck size={18} />}>
      <p className="text-sm text-gray-500 mb-4">
        This is a one-time setup for the person running this marketplace. Whoever knows this password can see every visitor and business, so keep it private.
      </p>
      <FieldLabel>Choose a password</FieldLabel>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit(password)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-gray-500"
      />
      <button onClick={() => onSubmit(password)} style={{ background: NAVY }} className="w-full py-2.5 rounded-lg text-white font-semibold text-sm">
        Set up admin access
      </button>
    </ModalShell>
  );
}

function AdminLoginModal({ onClose, onSubmit }) {
  const [password, setPassword] = useState("");
  return (
    <ModalShell onClose={onClose} title="Admin log in" icon={<Lock size={18} />}>
      <FieldLabel>Password</FieldLabel>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSubmit(password)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-gray-500"
      />
      <button onClick={() => onSubmit(password)} style={{ background: NAVY }} className="w-full py-2.5 rounded-lg text-white font-semibold text-sm">
        Log in
      </button>
    </ModalShell>
  );
}

function ModalShell({ title, icon, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 font-bold slasha-display text-gray-800">
            {icon} {title}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <label className="text-xs font-medium text-gray-500 mb-1 block">{children}</label>;
}
