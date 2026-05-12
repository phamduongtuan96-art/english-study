import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_PROMPT = `
Bạn là chuyên gia sư phạm tiếng Anh cấp cao, chuyên thiết kế bài học ESL/IELTS dựa trên nội dung thực tế.

QUY TẮC VẬN HÀNH (TECHNICAL CONSTRAINTS):
1. QUY TRÌNH XỬ LÝ:
   - Bước 1: Phân tích Transcript để xác định nội dung cốt lõi và mốc ngữ cảnh quan trọng.
   - Bước 2: Trích lọc từ vựng & ngữ pháp đúng theo khung CEFR (B1/B2).
   - Bước 3: Đảm bảo tính logic tuyệt đối: Câu hỏi và bài tập PHẢI có đáp án nằm trong transcript.
2. YÊU CẦU ĐẦU RA:
   - NO HALLUCINATIONS: Chỉ dùng thông tin có trong video. Không tự thêm kiến thức bên ngoài.
   - ERROR HANDLING: Nếu thiếu thông tin để tạo đủ số lượng yêu cầu, phải báo cáo cụ thể phần bị thiếu thay vì tự bịa ra.
   - Ngôn ngữ: Giải thích bằng tiếng Việt, ví dụ và bài tập bằng tiếng Anh.
   - BILINGUAL MODE: Đối với các câu ví dụ hoặc câu quan trọng, hãy cung cấp bản dịch tiếng Việt ngay sau đó trong ngoặc vuông, ví dụ: "The quick brown fox [Con cáo nâu nhanh nhẹn]".

CẤU TRÚC BÀI HỌC (Bắt buộc):

## 1. Warm-up (Khởi động)
- 3 keywords chính từ bài.
- 1 câu hỏi dự đoán nội dung dựa trên tiêu đề/chủ đề.

## 2. Deep Listening (Nghe sâu)
- **Cloze Test**: 3-5 câu điền từ vào chỗ trống từ các đoạn văn quan trọng.
- **Scrambled Sentences**: 3 câu hội thoại bị xáo trộn thứ tự từ để người học sắp xếp lại.

## 3. Vocabulary & Phrases in Context (Từ vựng & Mẫu câu)
- Liệt kê toàn bộ các từ vựng, thành ngữ hoặc cụm từ quan trọng xuất hiện trong transcript.
- Đối với mỗi từ/cụm từ, cung cấp:
  - **Word/Phrase**: [Từ/Cụm từ]
  - **Type**: [Loại từ]
  - **Meaning**: [Nghĩa tiếng Việt]
  - **Context Sentence**: [Câu ví dụ trích từ bài học]
- Đảm bảo danh sách này bao hàm đầy đủ các từ khóa then chốt của bài.

## 4. Grammar Transformation (Biến đổi ngữ pháp)
- Chọn 2 câu từ bài.
- Yêu cầu viết lại câu bằng cấu trúc tương đương ở trình độ B2 (ví dụ: Chuyển Active sang Passive, dùng Inversion, hoặc Relative Clauses).

## 5. Shadowing & Pronunciation (Nghe và lặp lại)
Cung cấp 3 câu quan trọng nhất từ bài để luyện tập Shadowing. Định dạng mỗi câu:
- S: [Câu tiếng Anh]
- T: [Phiên âm/Nhấn trọng âm]
- N: [Mẹo phát âm/Nối âm]

## 6. Critical Thinking (Tư duy phản biện)
- Viết 1 đoạn văn mẫu (80-100 chữ) tóm tắt quan điểm diễn giả.
- 3 câu hỏi gợi ý để người học nêu ý kiến cá nhân.

## Answer Key (Đáp án)
- Cung cấp đáp án rõ ràng cho tất cả các phần bài tập trên.

NGUYÊN TẮC: Giải thích bằng tiếng Việt, ví dụ bằng tiếng Anh.
`;

export async function extractVocabulary(content: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract ALL useful ESL/IELTS vocabulary, idioms, and collocations from this transcript: "${content.slice(0, 4000)}". 
      For each term provide: 
      1. The word/phrase.
      2. Word type (noun, verb, etc.).
      3. Meaning in Vietnamese.
      4. An example sentence from the context.
      5. A short visual prompt (3-5 words) for an AI image generator to illustrate this word literal or metaphorically.
      Return ONLY a JSON array: [{"word": "...", "type": "...", "meaning": "...", "example": "...", "imagePrompt": "..."}]`,
    });
    const jsonStr = (response.text || "[]").replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Error (extractVocabulary):", error);
    return [];
  }
}

export async function generateWordImage(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a high-quality, professional educational illustration for this concept: "${prompt}". Style: 3D render, vibrant, clean background, minimalist.`,
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error (generateWordImage):", error);
    return "";
  }
}

export async function generateContent(prompt: string, systemInstruction?: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction || "You are a helpful ESL assistant.",
        temperature: 0.7,
      },
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error (generateContent):", error);
    return "Error generating content.";
  }
}

export async function generateLesson(content: string) {
  try {
    if (!content) throw new Error("Content is empty");
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: content,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.7,
      },
    });
    const text = response.text;
    if (!text) throw new Error("Empty response from AI");
    return text;
  } catch (error: any) {
    console.error("Gemini Error (generateLesson):", error);
    if (error.message?.includes('quota')) return "Error: API Quota exceeded. Please try again later.";
    throw error;
  }
}

export async function getQuickExplanation(text: string, context: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Explain this phrase/sentence from an ESL perspective: "${text}". Context: "${context.slice(0, 500)}...". Provide meaning, pronunciation, level (CEFR), and 2 simple examples. Use Vietnamese for explanation.`,
    });
    return response.text || "No explanation could be generated.";
  } catch (error) {
    console.error("Gemini Error (getQuickExplanation):", error);
    return "Error generating explanation.";
  }
}

export async function getRoleplayResponse(userMessage: string, context: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tiếp tục hội thoại trong vai nhân vật từ bài học này: ${context.slice(0, 500)}. Người học vừa nói: "${userMessage}". Chỉ trả lời bằng tiếng Anh, ngắn gọn.`,
    });
    return response.text || "I'm sorry, I couldn't hear that.";
  } catch (error) {
    console.error("Gemini Error (getRoleplayResponse):", error);
    return "Error in conversation.";
  }
}

export async function getWritingFeedback(userText: string, context: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `As an ESL teacher, grade this summary (80-100 words) based on the context: "${context.slice(0, 500)}". 
    User's writing: "${userText}".
    1. Score out of 10.
    2. Correct grammar & vocabulary errors.
    3. Suggest B2-level improvements.
    Use Vietnamese for feedback.`,
    });
    return response.text || "No feedback available.";
  } catch (error) {
    console.error("Gemini Error (getWritingFeedback):", error);
    return "Error generating feedback.";
  }
}
