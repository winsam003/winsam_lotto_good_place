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
    console.log("🚀 [Batch Start] API 호출됨");

    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    console.log("🔑 [Auth Check]", {
        hasAuthHeader: !!authHeader,
        cronSecretExists: !!cronSecret,
    });

    const isAuthorized = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isAuthorized) {
        console.error("❌ [Auth Failed] 권한 없음");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logsCol = collection(db, "batch_logs");

    try {
        // [STEP 1] DB 조회 로그
        console.log("📡 [Step 1] Firestore에서 마지막 회차 조회 중...");
        const q = query(collection(db, "lotto_winners"), orderBy("drawNo", "desc"), limit(1));
        const snap = await getDocs(q);

        let lastDrawNo = 0;
        if (!snap.empty) {
            lastDrawNo = snap.docs[0].data().drawNo;
        }
        const targetDrawNo = lastDrawNo + 1;
        console.log(`✅ [Step 1 완료] 현재 DB 마지막 회차: ${lastDrawNo} -> 타겟 회차: ${targetDrawNo}`);

        // [STEP 2] 외부 API 호출 로그
        const url = `https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do?srchWnShpRnk=all&srchLtEpsd=${targetDrawNo}&srchShpLctn=&_=${Date.now()}`;
        console.log(`🌐 [Step 2] 동행복권 데이터 요청 시작: ${url}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store',
            headers: {
                // 봇 차단 방지를 위한 User-Agent 필수 추가
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            console.error(`❌ [Step 2 에러] HTTP status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        const winners = result.data?.list;
        console.log(`✅ [Step 2 완료] 받아온 데이터 개수: ${winners?.length || 0}개`);

        if (!winners || winners.length === 0) {
            console.warn("⚠️ [데이터 없음] 아직 동행복권에 데이터가 업데이트되지 않았습니다.");
            await writeBatch(db).set(doc(logsCol), {
                status: "PENDING",
                drawNo: targetDrawNo,
                message: "데이터 미업데이트",
                timestamp: serverTimestamp(),
            }).commit();
            return NextResponse.json({ success: false, message: "No data yet." });
        }

        // [STEP 3] Batch 작업 로그
        console.log("💾 [Step 3] Firestore Batch 작업 시작...");
        const batch = writeBatch(db);
        const storeMap = new Map();

        winners.forEach((item: any) => {
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

            const storeId = `${item.shpNm}_${item.shpAddr.replace(/\s/g, "")}`.replace(/\//g, "_").replace(/\./g, "");

            if (!storeMap.has(storeId)) {
                storeMap.set(storeId, {
                    first: 0, second: 0, lat: item.shpLat, lng: item.shpLot, name: item.shpNm, addr: item.shpAddr
                });
            }
            const current = storeMap.get(storeId);
            if (item.wnShpRnk === 1) current.first += 1;
            if (item.wnShpRnk === 2) current.second += 1;
        });

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
        batch.set(doc(logsCol), {
            status: "SUCCESS",
            drawNo: targetDrawNo,
            winnerCount: winners.length,
            timestamp: serverTimestamp(),
        });

        await batch.commit();
        console.log(`🎉 [모든 작업 완료] ${targetDrawNo}회차 업데이트 성공!`);

        return NextResponse.json({ success: true, drawNo: targetDrawNo });

    } catch (error: any) {
        const errorMsg = error.name === 'AbortError' ? '네트워크 타임아웃(10초)' : error.message;
        console.error("🔥 [최종 에러 발생]:", errorMsg);

        try {
            const errBatch = writeBatch(db);
            errBatch.set(doc(logsCol), {
                status: "FAILURE",
                message: errorMsg,
                timestamp: serverTimestamp(),
            });
            await errBatch.commit();
            console.log("📝 [에러 로그 저장 완료]");
        } catch (logErr) {
            console.error("🚫 [에러 로그 저장 실패]:", logErr);
        }

        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
