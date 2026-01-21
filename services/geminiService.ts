
import { GoogleGenAI, Type } from "@google/genai";
import { GeminiConfig } from '../types';

// Helper to determine API key to use
const getApiKey = (config: GeminiConfig) => {
  return config.apiKey || process.env.API_KEY || '';
};

// Generic generate content
export const getGeminiResponse = async (prompt: string, config: GeminiConfig): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey(config) });
    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || '';
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating response. Please check your API Key in Settings.";
  }
};

export const translateContent = async (text: string, targetLang: 'vi' | 'en', config: GeminiConfig): Promise<string> => {
  if (!text) return '';
  const prompt = config.prompts?.translation 
    ? config.prompts.translation.replace('{targetLanguage}', targetLang === 'vi' ? 'Vietnamese' : 'English').replace('{text}', text)
    : `Translate the following text to ${targetLang === 'vi' ? 'Vietnamese' : 'English'}: "${text}"`;
  
  return await getGeminiResponse(prompt, config);
};

export const translateBatch = async (items: Record<string, string>, targetLang: 'vi' | 'en', config: GeminiConfig): Promise<Record<string, string>> => {
  const prompt = `Translate the following JSON object values to ${targetLang === 'vi' ? 'Vietnamese' : 'English'}. Return ONLY the JSON object.
  Source: ${JSON.stringify(items)}`;
  
  const response = await getGeminiResponse(prompt, config);
  try {
    const jsonStr = response.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("Batch translation parsing error", e);
    return {};
  }
};

export const translateCourses = async (courses: any[], targetLang: 'vi' | 'en', config: GeminiConfig): Promise<{ id: string, name: string }[]> => {
  const sourceLang = targetLang === 'vi' ? 'en' : 'vi';
  // Filter items that actually have source text
  const items = courses
    .filter(c => c.name && c.name[sourceLang])
    .map(c => ({ id: c.id, text: c.name[sourceLang] }));

  if (items.length === 0) return [];

  const prompt = `Translate the following course names from ${sourceLang === 'vi' ? 'Vietnamese' : 'English'} to ${targetLang === 'vi' ? 'Vietnamese' : 'English'}.
  Return ONLY a JSON array of objects with keys "id" and "name" (the translated text). Do not include markdown formatting.
  Input: ${JSON.stringify(items)}`;

  const responseText = await getGeminiResponse(prompt, config);
  try {
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
      console.error("Failed to parse translated courses", e);
      return [];
  }
};

export const importFacultyFromPdf = async (base64Pdf: string, config: GeminiConfig): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey(config) });
    
    // PDF Part
    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Pdf
      }
    };

    const prompt = `
      Analyze this CV/Resume PDF and extract structured data for a Faculty Member profile.
      Return JSON format matching this structure:
      {
        "name": { "vi": "...", "en": "..." },
        "email": "...",
        "rank": { "vi": "...", "en": "..." }, // e.g. Lecturer, Senior Lecturer
        "degree": { "vi": "...", "en": "..." }, // e.g. PhD, Master
        "educationList": [ { "year": "...", "institution": {"vi": "...", "en": "..."}, "degree": {"vi": "...", "en": "..."} } ],
        "academicExperienceList": [ { "period": "...", "institution": {"vi": "...", "en": "..."}, "title": {"vi": "...", "en": "..."} } ],
        "publicationsList": [ { "text": {"vi": "...", "en": "..."} } ]
      }
      If a field is missing, omit it or use empty string. Ensure keys match exactly.
    `;

    const response = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash-latest', // Use flash for speed/cost with PDF
      contents: {
        parts: [pdfPart, { text: prompt }]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Import Faculty PDF Error:", error);
    return null;
  }
};

export const importProgramFromPdf = async (base64Pdf: string, config: GeminiConfig): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey(config) });
    
    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Pdf
      }
    };

    const prompt = `
      Analyze this Program Specification PDF. Extract the following:
      1. General Info (University, School, Program Name)
      2. PEOs (Program Educational Objectives)
      3. SOs (Student Outcomes)
      4. List of Courses (Code, Name, Credits)
      
      Return a JSON object with this structure:
      {
        "generalInfo": { "programName": {"vi": "", "en": ""}, "university": {"vi": "", "en": ""} },
        "peos": [{ "code": "PEO-1", "title": {"vi": "", "en": ""}, "description": {"vi": "", "en": ""} }],
        "sos": [{ "code": "SO-1", "description": {"vi": "", "en": ""} }],
        "courses": [{ "code": "...", "name": {"vi": "", "en": ""}, "credits": 3 }]
      }
    `;

    const response = await ai.models.generateContent({
      model: config.model || 'gemini-3-pro-preview',
      contents: {
        parts: [pdfPart, { text: prompt }]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Import Program PDF Error:", error);
    return null;
  }
};

export const importSyllabusFromPdf = async (base64Pdf: string, config: GeminiConfig): Promise<any> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey(config) });
    
    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64Pdf
      }
    };

    const prompt = `
      Analyze this Course Syllabus PDF. Extract structured data.
      Return a JSON object with this exact structure:
      {
        "description": { "vi": "...", "en": "..." },
        "textbooks": [ { "title": "...", "author": "...", "publisher": "...", "year": "...", "type": "textbook" | "reference" } ],
        "clos": { "vi": ["..."], "en": ["..."] },
        "topics": [ 
          { 
            "no": "1", 
            "topic": { "vi": "...", "en": "..." }, 
            "activities": [ { "type": "Lecture" | "Lab" | "Project" | "Exam", "hours": 0 } ]
          } 
        ],
        "assessmentPlan": [ { "type": { "vi": "...", "en": "..." }, "percentile": 0 } ]
      }
      If hours for activities are not explicit, estimate based on credit hours or set to 0.
      Try to translate content to both Vietnamese and English where possible.
    `;

    const response = await ai.models.generateContent({
      model: config.model || 'gemini-2.5-flash-latest',
      contents: {
        parts: [pdfPart, { text: prompt }]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Import Syllabus PDF Error:", error);
    return null;
  }
};

export const translateSyllabus = async (course: any, targetLang: 'vi' | 'en', config: GeminiConfig): Promise<any> => {
    const sourceLang = targetLang === 'vi' ? 'en' : 'vi';
    const toTranslate: Record<string, string> = {};

    // Collect strings to translate
    if (course.description && !course.description[targetLang] && course.description[sourceLang]) {
        toTranslate['description'] = course.description[sourceLang];
    }
    
    // Topics
    course.topics.forEach((t: any, idx: number) => {
        if (!t.topic[targetLang] && t.topic[sourceLang]) {
            toTranslate[`topic_${idx}`] = t.topic[sourceLang];
        }
    });

    // Assessment
    course.assessmentPlan.forEach((a: any, idx: number) => {
        if (!a.type[targetLang] && a.type[sourceLang]) {
            toTranslate[`assess_${idx}`] = a.type[sourceLang];
        }
    });

    // CLOs (List)
    const sourceClos = course.clos[sourceLang] || [];
    if (!course.clos[targetLang] || course.clos[targetLang].length === 0) {
        sourceClos.forEach((clo: string, idx: number) => {
            toTranslate[`clo_${idx}`] = clo;
        });
    }

    if (Object.keys(toTranslate).length === 0) return null;

    const translated = await translateBatch(toTranslate, targetLang, config);

    // Apply back
    const newCourse = JSON.parse(JSON.stringify(course));
    
    if (translated['description']) newCourse.description[targetLang] = translated['description'];
    
    newCourse.topics.forEach((t: any, idx: number) => {
        if (translated[`topic_${idx}`]) t.topic[targetLang] = translated[`topic_${idx}`];
    });

    newCourse.assessmentPlan.forEach((a: any, idx: number) => {
        if (translated[`assess_${idx}`]) a.type[targetLang] = translated[`assess_${idx}`];
    });

    if (!newCourse.clos[targetLang] || newCourse.clos[targetLang].length === 0) {
        newCourse.clos[targetLang] = sourceClos.map((_: any, idx: number) => translated[`clo_${idx}`] || "");
    }

    return newCourse;
};
