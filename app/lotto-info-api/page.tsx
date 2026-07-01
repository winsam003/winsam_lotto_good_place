"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, DatabaseZap, LockKeyhole } from "lucide-react";

interface LottoWinnerApiItem {
  ltShpId: string;
  rnum: number;
  shpNm: string | null;
  shpAddr: string | null;
  wnShpRnk: number;
  atmtPsvYnTxt: string | null;
  shpLat: number;
  shpLot: number;
}

export default function LottoTestPage() {
  const [loading, setLoading] = useState(false);
  const [currentDraw, setCurrentDraw] = useState<number | null>(null);
  const [startDraw, setStartDraw] = useState<number>(1200);
  const [endDraw, setEndDraw] = useState<number>(1207);

  // --- 비밀번호 관리 상태 ---
  const [inputPassword, setInputPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  const handleAdminAuth = () => {
    if (inputPassword === adminPassword) {
      setIsAdmin(true);
      alert("관리자 인증 성공! 데이터를 수집할 수 있습니다.");
    } else {
      alert("비밀번호가 틀렸습니다.");
      setInputPassword("");
    }
  };
  // -----------------------

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const fetchAndSaveRange = async () => {
    if (!isAdmin) return; // 이중 방어
    if (startDraw > endDraw) {
      alert("시작 회차가 종료 회차보다 클 수 없습니다.");
      return;
    }

    if (!confirm(`${startDraw}회부터 ${endDraw}회까지 수집을 시작할까요?`))
      return;

    setLoading(true);

    try {
      for (let i = startDraw; i <= endDraw; i++) {
        setCurrentDraw(i);
        const url = `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd=${i}&srchShpLctn=&_=${Date.now()}`;

        const response = await fetch(url);
        if (!response.ok) continue;

        const result = await response.json();
        const winners = result.data.list;

        if (winners && winners.length > 0) {
          const batch = writeBatch(db);
          winners.forEach((item: LottoWinnerApiItem) => {
            const docId = `${i}_${item.ltShpId}_${item.rnum}`;
            const docRef = doc(db, "lotto_winners", docId);
            batch.set(docRef, {
              drawNo: i,
              shopName: item.shpNm,
              address: item.shpAddr,
              rank: item.wnShpRnk,
              type: item.atmtPsvYnTxt,
              lat: item.shpLat,
              lng: item.shpLot,
              createdAt: new Date(),
            });
          });
          await batch.commit();
        }
        await sleep(1000);
      }
      alert("완료되었습니다!");
    } catch (error) {
      console.error(error);
      alert("에러 발생");
    } finally {
      setLoading(false);
      setCurrentDraw(null);
    }
  };

  return (
    <main className="page-canvas soft-grid flex min-h-screen items-center justify-center p-4 md:p-10">
      <div className="surface-card w-full max-w-md animate-enter rounded-[2rem] p-7 md:p-10">
        <Link
          href="/"
          className="mb-7 inline-flex items-center gap-2 text-xs font-extrabold text-[#68738a] transition hover:text-[#4f46e5]"
        >
          <ArrowLeft size={15} /> 메인으로
        </Link>

        <div className="mb-8 flex items-center gap-3"><span className="flex size-11 items-center justify-center rounded-2xl bg-[#eef0ff] text-[#4f46e5]"><DatabaseZap size={20} /></span><div><p className="eyebrow">Admin tool</p><h1 className="mt-0.5 text-2xl font-black tracking-[-0.04em] text-[#172033]">로또 데이터 수집</h1></div></div>

        {!isAdmin ? (
          /* 비밀번호 입력 화면 */
          <div className="mt-6 space-y-4">
            <p className="ml-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8f97a8]"><LockKeyhole size={13} /> Admin password</p>
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdminAuth()}
              placeholder="비밀번호를 입력하세요"
              className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] p-4 font-bold outline-none"
            />
            <button
              onClick={handleAdminAuth}
              className="w-full rounded-2xl bg-[#4f46e5] py-4 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#4338ca] active:scale-[0.98]"
            >
              로그인
            </button>
          </div>
        ) : (
          /* 실제 수집기 화면 */
          <div className="mt-8">
            <div className="mb-6 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center text-[10px] font-bold text-emerald-600">
              ✅ 관리자 인증됨
            </div>

            <div className="space-y-6 mb-10">
              <div className="flex gap-4 items-center justify-between">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">
                    START DRAW
                  </label>
                  <input
                    type="number"
                    value={startDraw}
                    onChange={(e) => setStartDraw(Number(e.target.value))}
                    className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] p-4 text-center font-bold outline-none"
                    disabled={loading}
                  />
                </div>
                <div className="mt-6 font-bold text-gray-300">~</div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">
                    END DRAW
                  </label>
                  <input
                    type="number"
                    value={endDraw}
                    onChange={(e) => setEndDraw(Number(e.target.value))}
                    className="focus-field w-full rounded-2xl border border-[#e3e5ee] bg-[#fafbfc] p-4 text-center font-bold outline-none"
                    disabled={loading}
                  />
                </div>
              </div>

              {loading && (
                <div className="animate-pulse rounded-2xl border border-[#dfe2fb] bg-[#f1f2ff] p-4 text-center text-sm font-bold text-[#5651c9]">
                  🚀 현재 {currentDraw}회차 수집 중...
                </div>
              )}
            </div>

            <button
              onClick={fetchAndSaveRange}
              disabled={loading}
              className={`w-full py-5 rounded-2xl text-white font-black shadow-lg transition-all active:scale-95 ${
                loading
                  ? "bg-gray-300 cursor-not-allowed"
                  : "bg-[#4f46e5] hover:bg-[#4338ca]"
              }`}
            >
              {loading ? "DATA COLLECTING..." : "데이터 수집 시작"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
