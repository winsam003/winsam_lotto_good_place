"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, writeBatch } from "firebase/firestore";

export default function LottoTestPage() {
  const [loading, setLoading] = useState(false);
  const [currentDraw, setCurrentDraw] = useState<number | null>(null);

  // 시작/종료 회차 상태 관리
  const [startDraw, setStartDraw] = useState<number>(1200);
  const [endDraw, setEndDraw] = useState<number>(1207);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const fetchAndSaveRange = async () => {
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
        console.log(`🚀 ${i}회차 수집 시작...`);

        const url = `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd=${i}&srchShpLctn=&_=${Date.now()}`;

        const response = await fetch(url);
        if (!response.ok) {
          console.error(`${i}회차 호출 실패`);
          continue;
        }

        const result = await response.json();
        const winners = result.data.list;

        console.log(`📡 ${i}회차 API 응답 데이터:`, winners);

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
          console.log(`✅ ${i}회차 저장 완료 (${winners.length}개 지점)`);
        }

        await sleep(1000); // 1초 휴식
      }

      alert("모든 회차 수집 및 저장이 완료되었습니다!");
    } catch (error) {
      console.error("❌ 에러 발생:", error);
    } finally {
      setLoading(false);
      setCurrentDraw(null);
    }
  };

  return (
    <div className="p-20 text-center">
      <h1 className="text-2xl font-bold mb-8">로또 대량 수집 도구</h1>

      {/* 입력 섹션 */}
      <div className="flex justify-center items-center gap-4 mb-8">
        <div>
          <label className="block text-sm text-gray-600 mb-1">시작 회차</label>
          <input
            type="number"
            value={startDraw}
            onChange={(e) => setStartDraw(Number(e.target.value))}
            className="border p-2 rounded w-24 text-center"
            disabled={loading}
          />
        </div>
        <span className="mt-6 text-xl">~</span>
        <div>
          <label className="block text-sm text-gray-600 mb-1">종료 회차</label>
          <input
            type="number"
            value={endDraw}
            onChange={(e) => setEndDraw(Number(e.target.value))}
            className="border p-2 rounded w-24 text-center"
            disabled={loading}
          />
        </div>
      </div>

      {loading && (
        <div className="mb-4 text-blue-600 font-bold animate-pulse">
          현재 {currentDraw}회차 수집 중...
        </div>
      )}

      <button
        onClick={fetchAndSaveRange}
        disabled={loading}
        className={`px-8 py-4 rounded-lg text-white font-bold shadow-lg transition-all ${
          loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-red-500 hover:bg-red-600"
        }`}
      >
        {loading ? "수집 진행 중..." : "수집 및 DB 저장 시작"}
      </button>

      <div className="mt-8 text-sm text-gray-400">
        * 회차당 1초씩 대기하며 서버 부하를 방지합니다.
      </div>
    </div>
  );
}
