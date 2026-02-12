import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    doc,
    writeBatch,
    increment,
    serverTimestamp,
} from "firebase/firestore";

// Vercel 실행 제한 시간 설정 (최대 60초)
export const maxDuration = 60;

export async function GET(request: Request) {
    // 1. 보안 검증 (Bearer 비번 OR Vercel 시스템 호출 체크)
    const authHeader = request.headers.get("authorization");
    const vercelCronHeader = request.headers.get("x-vercel-cron");
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

    const isAuthorized = authHeader === `Bearer ${adminPassword}`;
    const isVercelSystem = vercelCronHeader === "1";

    if (!isAuthorized && !isVercelSystem) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logsCol = collection(db, "batch_logs");

    try {
        // [STEP 1] DB에서 마지막 회차 조회
        const q = query(collection(db, "lotto_winners"), orderBy("drawNo", "desc"), limit(1));
        const snap = await getDocs(q);

        let lastDrawNo = 0;
        if (!snap.empty) {
            lastDrawNo = snap.docs[0].data().drawNo;
        }
        const targetDrawNo = lastDrawNo + 1;

        // [STEP 2] 동행복권 데이터 가져오기 (타임아웃 적용)
        const url = `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd=${targetDrawNo}&srchShpLctn=&_=${Date.now()}`;

        // 네트워크 지연 시 10초 후 자동 중단 설정
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store' // 캐시 무시하고 항상 새 데이터 요청
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const result = await response.json();
        const winners = result.data.list;

        // 데이터가 아직 없는 경우 (추첨 직후 등)
        if (!winners || winners.length === 0) {
            const logRef = doc(logsCol);
            await writeBatch(db).set(logRef, {
                status: "PENDING",
                drawNo: targetDrawNo,
                message: "데이터 미업데이트",
                timestamp: serverTimestamp(),
            }).commit();

            return NextResponse.json({ success: false, message: "No data yet." });
        }

        // [STEP 3] Batch 작업 시작
        const batch = writeBatch(db);
        const storeMap = new Map();

        winners.forEach((item: any) => {
            // 당첨 기록 저장
            const winnerDocId = `${targetDrawNo}_${item.ltShpId}_${item.rnum}`;
            const winnerRef = doc(db, "lotto_winners", winnerDocId);
            batch.set(winnerRef, {
                drawNo: targetDrawNo,
                shopName: item.shpNm,
                address: item.shpAddr,
                rank: item.wnShpRnk,
                type: item.atmtPsvYnTxt,
                lat: item.shpLat,
                lng: item.shpLot,
                createdAt: new Date(),
            });

            // 매장 ID 생성 및 통계 준비
            const storeId = `${item.shpNm}_${item.shpAddr.replace(/\s/g, "")}`
                .replace(/\//g, "_")
                .replace(/\./g, "");

            if (!storeMap.has(storeId)) {
                storeMap.set(storeId, {
                    first: 0, second: 0, lat: item.shpLat, lng: item.shpLot, name: item.shpNm, addr: item.shpAddr
                });
            }
            const current = storeMap.get(storeId);
            if (item.wnShpRnk === 1) current.first += 1;
            if (item.wnShpRnk === 2) current.second += 1;
        });

        // 매장 통계 합산 업데이트
        storeMap.forEach((val, id) => {
            const storeRef = doc(db, "lotto_stores", id);
            batch.set(storeRef, {
                shopName: val.name,
                address: val.addr,
                lat: val.lat,
                lng: val.lng,
                firstPrizeCount: increment(val.first),
                secondPrizeCount: increment(val.second),
                lastUpdatedDraw: targetDrawNo,
                updatedAt: serverTimestamp(),
            }, { merge: true });
        });

        // 성공 로그 기록
        const successLogRef = doc(logsCol);
        batch.set(successLogRef, {
            status: "SUCCESS",
            drawNo: targetDrawNo,
            winnerCount: winners.length,
            timestamp: serverTimestamp(),
        });

        await batch.commit();

        return NextResponse.json({ success: true, drawNo: targetDrawNo });

    } catch (error: any) {
        console.error("Batch Update Error:", error);

        // 에러 발생 시 로그 저장 시도
        try {
            const errBatch = writeBatch(db);
            errBatch.set(doc(logsCol), {
                status: "FAILURE",
                message: error.name === 'AbortError' ? '네트워크 타임아웃' : error.message,
                timestamp: serverTimestamp(),
            });
            await errBatch.commit();
        } catch (logErr) {
            console.error("Logging failed:", logErr);
        }

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}