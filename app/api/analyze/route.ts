import { NextResponse } from 'next/server';
import { client, handle_file } from '@gradio/client';

export async function POST(req: Request) {
  try {
    const arrayBuffer = await req.arrayBuffer();
    const audioFile = new File([arrayBuffer], "rekaman.wav", { type: 'audio/wav' });

    // 1. Hubungkan ke Space Anda
    const app = await client("suyagi/NEW_AST_FINAL");

    // 2. Tembak nama API yang PASTI BENAR (bukan pakai angka Index lagi)
    const result = await app.predict("/prediksi", [
        handle_file(audioFile) 
    ]);

    const outputData = result.data as any[];
    
    let formattedResult = [];
    if (outputData[0] && outputData[0].confidences) {
        formattedResult = outputData[0].confidences.map((c: any) => ({
            label: c.label,
            score: c.confidence 
        }));
    } else {
        const dict = outputData[0];
        formattedResult = Object.keys(dict).map(key => ({
            label: key,
            score: dict[key]
        }));
    }

    return NextResponse.json(formattedResult, { status: 200 });

  } catch (error: any) {
    console.error("============= ERROR DARI GRADIO SPACE =============");
    console.error(error);
    console.error("===================================================");
    return NextResponse.json({ error: "Gagal memproses via Space." }, { status: 500 });
  }
}