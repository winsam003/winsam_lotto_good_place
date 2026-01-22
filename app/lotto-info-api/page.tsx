"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";
import Link from "next/link";

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
          winners.forEach((item: any) => {
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
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4 md:p-10 font-sans text-black">
      <div className="w-full max-w-md bg-white rounded-[2rem] shadow-xl p-8 md:p-12 border border-gray-100">
        <Link
          href="/"
          className="text-blue-500 text-sm font-bold mb-6 inline-block"
        >
          ← 메인으로
        </Link>

        <h1 className="text-xl md:text-2xl font-black mb-2 text-gray-800">
          로또 데이터 수집기 🛠️
        </h1>

        {!isAdmin ? (
          /* 비밀번호 입력 화면 */
          <div className="mt-10 space-y-4">
            <p className="text-sm text-gray-500 font-bold ml-1">
              ADMIN PASSWORD
            </p>
            <input
              type="password"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdminAuth()}
              placeholder="비밀번호를 입력하세요"
              className="w-full border-2 border-gray-100 p-4 rounded-2xl font-bold focus:border-blue-500 outline-none transition-all"
            />
            <button
              onClick={handleAdminAuth}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-black shadow-lg"
            >
              로그인
            </button>
          </div>
        ) : (
          /* 실제 수집기 화면 */
          <div className="mt-8">
            <div className="bg-green-50 text-green-600 p-3 rounded-xl text-center text-[10px] font-bold mb-6">
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
                    className="w-full border-2 border-gray-100 p-4 rounded-2xl text-center font-bold focus:border-red-500 outline-none transition-all"
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
                    className="w-full border-2 border-gray-100 p-4 rounded-2xl text-center font-bold focus:border-red-500 outline-none transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              {loading && (
                <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl text-center text-sm font-bold animate-pulse">
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
                  : "bg-red-500 hover:bg-red-600"
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
