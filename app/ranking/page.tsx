"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, MapPin, Search, Trophy } from "lucide-react";

// [추가] 타입 에러 방지를 위한 인터페이스 정의
interface LottoStore {
  id: string;
  shopName: string;
  address: string;
  lat: number;
  lng: number;
  firstPrizeCount: number;
  secondPrizeCount: number;
  lastUpdatedDraw: number;
}

export default function RankingPage() {
  const [allWinners, setAllWinners] = useState<LottoStore[]>([]);
  const [filteredWinners, setFilteredWinners] = useState<LottoStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "lotto_stores"),
          orderBy("firstPrizeCount", "desc"),
          limit(300)
        );

        const snap = await getDocs(q);
        const results = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as LottoStore[]; // [수정] 타입 단언으로 에러 해결

        results.sort((a, b) => {
          if (b.firstPrizeCount !== a.firstPrizeCount) {
            return b.firstPrizeCount - a.firstPrizeCount;
          }
          return (b.secondPrizeCount || 0) - (a.secondPrizeCount || 0);
        });

        setAllWinners(results);
        setFilteredWinners(results);
      } catch (err) {
        console.error("데이터 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    const term = keyword.trim().toLowerCase();
    if (!term) {
      setFilteredWinners(allWinners);
      return;
    }
    const filtered = allWinners.filter(
      (store) =>
        store.address?.toLowerCase().includes(term) ||
        store.shopName?.toLowerCase().includes(term)
    );
    setFilteredWinners(filtered);
  }, [keyword, allWinners]);

  // [수정] 클릭 시 좌표와 ID를 들고 메인 지도로 이동
  const goToStoreOnMap = (store: LottoStore) => {
    router.push(`/?storeId=${store.id}&lat=${store.lat}&lng=${store.lng}`);
  };

  const getRankDisplay = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return index + 1;
  };

  return (
    <main className="page-canvas soft-grid px-4 py-7 md:px-6 md:py-12">
      <div className="mx-auto max-w-5xl animate-enter">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#68738a] transition hover:text-[#4f46e5]">
          <ArrowLeft size={15} /> 지도로 돌아가기
        </Link>

        <header className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-xl bg-[#fff1d8] text-[#c47a16]"><Trophy size={16} /></span>
              <p className="eyebrow">All-time ranking</p>
            </div>
            <h1 className="text-3xl font-black tracking-[-0.05em] text-[#172033] md:text-5xl">역대 로또 명당</h1>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-[#737d91]">전국에서 1등 당첨을 가장 많이 배출한 판매점 100곳을 보여드려요.</p>
          </div>
          <div className="rounded-2xl border border-[#e2e4ef] bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#9aa1b1]">Loaded stores</span>
            <strong className="ml-3 text-lg font-black text-[#4f46e5]">{allWinners.length}</strong>
          </div>
        </header>

        <div className="glass-panel mb-5 flex items-center rounded-2xl px-4 py-1">
          <Search size={18} className="shrink-0 text-[#9299aa]" />
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="동네 또는 판매점 이름으로 검색" className="focus-field w-full border-0 bg-transparent px-3 py-3.5 text-sm font-semibold outline-none placeholder:text-[#a4aaba]" />
        </div>

        <section className="surface-card overflow-hidden rounded-[1.5rem] md:rounded-[2rem]">
          {!isLoading ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead><tr className="border-b border-[#eceef4] bg-[#fafbfc] text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#969daf]"><th className="w-24 px-6 py-5 text-center">순위</th><th className="px-6 py-5">판매점</th><th className="px-6 py-5 text-center">1등 배출</th><th className="px-6 py-5 text-center">2등 배출</th><th className="w-12" /></tr></thead>
                  <tbody className="divide-y divide-[#f0f1f5]">
                    {filteredWinners.slice(0, 100).map((store, index) => (
                      <tr key={store.id} className="group cursor-pointer transition hover:bg-[#f8f8ff]" onClick={() => goToStoreOnMap(store)}>
                        <td className="px-6 py-5 text-center"><span className={`inline-flex size-10 items-center justify-center rounded-xl font-black ${index < 3 ? "bg-[#fff7e7] text-xl" : "bg-[#f3f4f8] text-sm text-[#7d8699]"}`}>{getRankDisplay(index)}</span></td>
                        <td className="px-6 py-5"><p className="font-extrabold text-[#293248] transition group-hover:text-[#4f46e5]">{store.shopName}</p><p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[#969daf]"><MapPin size={12} /> {store.address}</p></td>
                        <td className="px-6 py-5 text-center"><span className="inline-flex min-w-16 justify-center rounded-xl bg-[#fff0ed] px-3 py-2 text-sm font-black text-[#e35e49]">{store.firstPrizeCount || 0}회</span></td>
                        <td className="px-6 py-5 text-center"><span className="inline-flex min-w-16 justify-center rounded-xl bg-[#edf3ff] px-3 py-2 text-sm font-black text-[#4771bd]">{store.secondPrizeCount || 0}회</span></td>
                        <td className="pr-5 text-[#b0b5c1]"><ChevronRight size={17} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-3 md:hidden">
                {filteredWinners.slice(0, 100).map((store, index) => (
                  <button key={store.id} className="lift-card w-full rounded-2xl border border-[#e8eaf1] bg-white p-4 text-left" onClick={() => goToStoreOnMap(store)}>
                    <div className="flex items-start gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-black ${index < 3 ? "bg-[#fff5df] text-xl" : "bg-[#f3f4f8] text-sm text-[#70798d]"}`}>{getRankDisplay(index)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#293248]">{store.shopName}</p><p className="mt-1 flex items-start gap-1 text-[10px] leading-4 text-[#969daf]"><MapPin size={11} className="mt-0.5 shrink-0" /> {store.address}</p></div><ChevronRight size={16} className="mt-2 text-[#b1b6c3]" /></div>
                    <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#fff0ed] px-3 py-2.5"><span className="block text-[9px] font-extrabold text-[#d87868]">1등 배출</span><strong className="mt-0.5 block text-base font-black text-[#e35e49]">{store.firstPrizeCount || 0}회</strong></div><div className="rounded-xl bg-[#edf3ff] px-3 py-2.5"><span className="block text-[9px] font-extrabold text-[#6e89ba]">2등 배출</span><strong className="mt-0.5 block text-base font-black text-[#4771bd]">{store.secondPrizeCount || 0}회</strong></div></div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="py-24 text-center"><div className="mx-auto mb-4 size-8 animate-spin rounded-full border-4 border-[#dedff4] border-t-[#4f46e5]" /><p className="text-xs font-extrabold tracking-[0.14em] text-[#6761d4]">RANKING LOADING</p></div>
          )}
        </section>
      </div>
    </main>
  );
}
