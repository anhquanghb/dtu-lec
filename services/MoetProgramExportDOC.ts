
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, VerticalAlign, HeadingLevel } from "docx";
import { Course, Faculty, GeneralInfo, Language, MoetInfo, MoetObjective, TeachingMethod, AssessmentMethod, SO } from '../types';

const htmlToPdfText = (html: string) => {
    if (!html) return "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const ulItems = tempDiv.querySelectorAll("ul li");
    ulItems.forEach(li => { li.textContent = "• " + li.textContent + "\n"; });
    const olItems = tempDiv.querySelectorAll("ol");
    olItems.forEach(ol => {
      const liItems = ol.querySelectorAll("li");
      liItems.forEach((li, idx) => { li.textContent = `${idx + 1}. ` + li.textContent + "\n"; });
    });
    const blocks = tempDiv.querySelectorAll("p, div, br");
    blocks.forEach((block) => {
        if (block.tagName === "BR") { block.replaceWith("\n"); } 
        else { block.textContent = `${block.textContent}\n`; }
    });
    let text = tempDiv.textContent || "";
    return text.replace(/\n\s*\n/g, "\n\n").trim();
};

export const exportMoetDocx = async (
    generalInfo: GeneralInfo,
    moetInfo: MoetInfo,
    courses: Course[],
    faculties: Faculty[],
    language: Language,
    sortedObjectives: MoetObjective[],
    impliedCourseObjectiveLinks: Set<string>,
    teachingMethods: TeachingMethod[],
    assessmentMethods: AssessmentMethod[],
    sos: SO[]
) => {
    // --- Helper function for objective labels (A, B, C...) ---
    const getObjectiveLabel = (id: string) => {
        const index = sortedObjectives.findIndex(ob => ob.id === id);
        if (index === -1) return '?';
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (index < letters.length) return letters[index];
        return letters[index % letters.length] + Math.floor(index / letters.length);
    };

    try {
        const styles = {
            h1: {
                bold: true,
                italics: false,
                size: 27, 
                color: "000000",
                font: "Times New Roman"
            },
            h2: {
                bold: true,
                italics: true,
                size: 26, 
                color: "000000",
                font: "Times New Roman"
            },
            h3: {
                bold: false,
                italics: true,
                size: 26, 
                color: "000000",
                font: "Times New Roman"
            }
        };

        const titleStyle = { font: "Times New Roman", size: 26, bold: true };
        const headerStyle = { font: "Times New Roman", size: 24, bold: true };
        const bodyStyle = { font: "Times New Roman", size: 26 };
        const tableHeaderStyle = { font: "Times New Roman", size: 22, bold: true };
        const tableBodyStyle = { font: "Times New Roman", size: 22 };

        // Helper to Create Paragraphs with Heading Levels
        const createPara = (text: string, options: any = {}) => new Paragraph({ 
            children: [new TextRun({ text, ...options.font })], 
            ...options.para 
        });
        
        // --- Helper to convert HTML to DOCX Paragraphs (Optimized for Nested Lists) ---
        const convertHtmlToDocx = (html: string) => {
            const text = htmlToPdfText(html);
            return text.split('\n').filter(t => t.trim()).map(t => new Paragraph({
                children: [new TextRun({ text: t, ...bodyStyle })],
                // Thêm thuộc tính indent để lùi dòng đầu tiên
                indent: { firstLine: 720 }, 
                spacing: { after: 100 }
            }));
        };

        const createTable = (headers: string[], rows: string[][], widths: number[]) => {
            return new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: headers.map((h, i) => new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: h, ...tableHeaderStyle })], alignment: AlignmentType.CENTER })],
                            width: { size: widths[i], type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER,
                            shading: { fill: "E0E0E0" }
                        }))
                    }),
                    ...rows.map(row => new TableRow({
                        children: row.map((cell, i) => new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: cell || "", ...tableBodyStyle })], alignment: i === 1 ? AlignmentType.LEFT : AlignmentType.CENTER })],
                            width: { size: widths[i], type: WidthType.PERCENTAGE },
                            verticalAlign: VerticalAlign.CENTER
                        }))
                    }))
                ]
            });
        };

        // --- Calculate Total Credits ---
        let totalCreditsCount = 0;
        const structure = moetInfo.programStructure || { gen: [], fund: [], spec: [], grad: [] };
        ['gen', 'fund', 'spec', 'grad'].forEach(blockKey => {
            (structure[blockKey as keyof typeof structure] || []).forEach(id => {
                const c = courses.find(x => x.id === id);
                if (c) totalCreditsCount += c.credits;
            });
        });
        (moetInfo.subBlocks || []).forEach(sb => totalCreditsCount += (sb.minCredits || 0));

        // --- SECTION 8 Content with Headers outside Table ---
        const section8Children: any[] = [];
        const processBlock = (blockTitle: string, indexPrefix: string, ids: string[], blockType: string) => {
            // Main Block Header (Heading 2)
            section8Children.push(createPara(`${indexPrefix}. ${blockTitle}`, { font: styles.h2, para: { heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } } }));
            
            // Compulsory (Heading 3)
            if(ids.length > 0) {
                section8Children.push(createPara(`${indexPrefix}.1. ${language === 'vi' ? 'Học phần bắt buộc' : 'Compulsory' }`, { font: styles.h3, para: { heading: HeadingLevel.HEADING_3, spacing: { before: 100, after: 100 } } }));
                const compRows = ids.map(id => {
                    const c = courses.find(x => x.id === id);
                    if(!c) return ["", "", "", ""];
                    return [c.code, c.name[language], c.credits.toString(), `LEC: ${c.credits}`];
                });
                section8Children.push(createTable(["Mã môn", "Tên môn học", "Số TC", "Cụ thể"], compRows, [15, 45, 10, 30]));
                section8Children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
            }

            // Electives (Heading 3)
            const subs = (moetInfo.subBlocks || []).filter(sb => sb.parentBlockId === blockType);
            if(subs.length > 0) {
                section8Children.push(createPara(`${indexPrefix}.2. ${language === 'vi' ? 'Học phần tự chọn' : 'Electives' }`, { font: styles.h3, para: { heading: HeadingLevel.HEADING_3, spacing: { before: 100, after: 100 } } }));
                
                subs.forEach(sb => {
                    // Sub-block Name as bold paragraph
                    section8Children.push(createPara(`${sb.name[language]} (Min ${sb.minCredits} cr)`, { font: { ...tableHeaderStyle, italics: true }, para: { spacing: { before: 100 } } }));
                    
                    const elecRows = sb.courseIds.map(id => {
                        const c = courses.find(x => x.id === id);
                        if(!c) return ["", "", "", ""];
                        return [c.code, c.name[language], c.credits.toString(), `LEC: ${c.credits}`];
                    });
                    section8Children.push(createTable(["Mã môn", "Tên môn học", "Số TC", "Cụ thể"], elecRows, [15, 45, 10, 30]));
                    section8Children.push(new Paragraph({ text: "", spacing: { after: 100 } }));
                });
            }
        };

        processBlock(language === 'vi' ? 'Kiến thức giáo dục đại cương' : 'General Education', '8.1', moetInfo.programStructure.gen, 'gen');
        processBlock(language === 'vi' ? 'Kiến thức cơ sở ngành' : 'Fundamental Engineering', '8.2', moetInfo.programStructure.fund, 'fund');
        processBlock(language === 'vi' ? 'Kiến thức chuyên ngành' : 'Specialized Engineering', '8.3', moetInfo.programStructure.spec, 'spec');
        processBlock(language === 'vi' ? 'Tốt nghiệp cuối khóa' : 'Graduation', '8.4', moetInfo.programStructure.grad, 'grad');

        // --- SECTION 11: SYLLABI ---
        const section11Children: any[] = [];
        const sortedCourses = [...courses].sort((a,b) => a.semester - b.semester || a.code.localeCompare(b.code));
        
        const SYLLABUS_LABELS = {
            vi: {
              creditHours: "Số tín chỉ", instructorInfo: "Thông tin Giảng viên", classInfo: "Thông tin Lớp học",
              textbook: "Giáo trình", references: "Tài liệu tham khảo", description: "Mô tả học phần",
              program: "Chương trình đào tạo", prereq: "Tiên quyết", coreq: "Song hành", status: "Loại hình",
              required: "Bắt buộc (R)", selectedElective: "Tự chọn định hướng (SE)", elective: "Tự chọn tự do (E)",
              topics: "NỘI DUNG ĐỀ MỤC & THỜI KHÓA", contentNo: "STT", time: "Thời lượng", topic: "Nội dung", readings: "Tài liệu đọc",
              assessment: "KẾ HOẠCH ĐÁNH GIÁ", assessmentType: "Hình thức", percentile: "Tỷ lệ", total: "Tổng cộng",
              clos: "CHUẨN ĐẦU RA HỌC PHẦN (CLOs)", closIntro: "Sau khi hoàn thành học phần này, sinh viên có khả năng:",
              relationship: "MA TRẬN QUAN HỆ GIỮA CĐR HỌC PHẦN (CLOs) VÀ CĐR CHƯƠNG TRÌNH (SOs)",
              cloCol: "CĐR Học phần", topicCol: "Nội dung", methodCol: "Phương pháp giảng dạy", assessCol: "Hình thức đánh giá", levelCol: "Mức độ", soCol: "CĐR Chương trình", credit: "tín chỉ"
            },
            en: {
              creditHours: "No. of Credit Hours", instructorInfo: "Instructor Information", classInfo: "Class Information",
              textbook: "Textbook", references: "Reference Materials", description: "Course Description",
              program: "Academic Program", prereq: "Prerequisite(s)", coreq: "Co-requisite(s)", status: "Course Status",
              required: "Required (R)", selectedElective: "Selected Elective (SE)", elective: "Elective (E)",
              topics: "COURSE TOPICS & SCHEDULES", contentNo: "Content No.", time: "Amount of Time", topic: "Course Topic", readings: "Readings",
              assessment: "COURSE ASSESSMENT PLAN", assessmentType: "Assessment Type", percentile: "Grade Percentile", total: "Total",
              clos: "COURSE LEARNING OUTCOMES (CLOs)", closIntro: "Upon completion of this course, the student should be able to:",
              relationship: "RELATIONSHIP BETWEEN CLOs AND SOs",
              cloCol: "CLO", topicCol: "Topics", methodCol: "Methodology", assessCol: "Assessment", levelCol: "Level", soCol: "SO", credit: "credit(s)"
            }
        };
        const lbl = SYLLABUS_LABELS[language];

        sortedCourses.forEach((c, idx) => {
            const mainInstructorId = c.instructorIds.find(id => c.instructorDetails[id]?.isMain) || c.instructorIds[0];
            const faculty = faculties.find(f => f.id === mainInstructorId);
            
            // --- Info Calculation ---
            const instructorStr = faculty ? `${faculty.name[language]}\nEmail: ${faculty.email || ''}` : "N/A";
            const classInfoStr = mainInstructorId && c.instructorDetails[mainInstructorId]?.classInfo || "N/A";
            
            const methodHours: Record<string, number> = {};
            c.topics.forEach(t => { t.activities.forEach(a => { methodHours[a.methodId] = (methodHours[a.methodId] || 0) + a.hours; }); });
            const creditDetails = Object.entries(methodHours).map(([mid, hours]) => {
                const method = teachingMethods.find(tm => tm.id === mid);
                if (!method) return null;
                const factor = method.hoursPerCredit || 15;
                const val = Math.ceil(hours / factor); return val > 0 ? `${method.code}: ${val}` : null;
            }).filter(Boolean).join(', ');
            const creditString = `${c.credits} ${lbl.credit}${creditDetails ? `\n(${creditDetails})` : ''}`;

            const resolveCodes = (ids: string[]) => ids.map(id => {
                const found = courses.find(x => x.id === id || x.code === id);
                return found ? found.code : id;
            }).join(', ');

            // Header for Course (Heading 3)
            section11Children.push(createPara(`11.${idx + 1}. ${c.code} - ${c.name[language]}`, { font: styles.h3, para: { heading: HeadingLevel.HEADING_3, spacing: { before: 300, after: 100 } } }));
            
            // Table 1: Info Table
            section11Children.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: [
                        new TableCell({ children: [createPara(lbl.creditHours, { font: tableHeaderStyle })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                        new TableCell({ children: [createPara(lbl.instructorInfo, { font: tableHeaderStyle })], width: { size: 45, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                        new TableCell({ children: [createPara(lbl.classInfo, { font: tableHeaderStyle })], width: { size: 35, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                    ]}),
                    new TableRow({ children: [
                        new TableCell({ children: [createPara(creditString, { font: tableBodyStyle })], width: { size: 20, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [createPara(instructorStr, { font: tableBodyStyle })], width: { size: 45, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [createPara(classInfoStr, { font: tableBodyStyle })], width: { size: 35, type: WidthType.PERCENTAGE } }),
                    ]})
                ]
            }));
            section11Children.push(new Paragraph({ text: "", spacing: { after: 100 } }));

            // Textbooks
            section11Children.push(createPara(lbl.textbook + ":", { font: { ...headerStyle, size: 24 } }));
            const books = c.textbooks.filter(t => t.type === 'textbook');
            if (books.length > 0) {
                books.forEach((tb, i) => section11Children.push(createPara(`${i+1}. ${tb.author} (${tb.year}). ${tb.title}. ${tb.publisher}.`, { font: bodyStyle })));
            } else {
                section11Children.push(createPara("N/A", { font: bodyStyle }));
            }

            // References
            section11Children.push(createPara(lbl.references + ":", { font: { ...headerStyle, size: 24 }, para: { spacing: { before: 100 } } }));
            const refs = c.textbooks.filter(t => t.type === 'reference');
            if (refs.length > 0) {
                refs.forEach((tb, i) => section11Children.push(createPara(`${i+1}. ${tb.author} (${tb.year}). ${tb.title}. ${tb.publisher}.`, { font: bodyStyle })));
            } else {
                section11Children.push(createPara("N/A", { font: bodyStyle }));
            }

            // Description
            section11Children.push(createPara(lbl.description + ":", { font: { ...headerStyle, size: 24 }, para: { spacing: { before: 100 } } }));
            section11Children.push(...convertHtmlToDocx(c.description[language]));

            // Table 2: Program Context
            const statusText = `${c.type === 'REQUIRED' ? '[x]' : '[ ]'} ${lbl.required}   ${c.type === 'SELECTED_ELECTIVE' ? '[x]' : '[ ]'} ${lbl.selectedElective}   ${c.type === 'ELECTIVE' ? '[x]' : '[ ]'} ${lbl.elective}`;
            section11Children.push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({ children: [
                        new TableCell({ children: [createPara(`${lbl.program}: ${generalInfo.programName[language] || ""}`, { font: { ...tableHeaderStyle, bold: true } })], columnSpan: 3, shading: { fill: "E0E0E0" } })
                    ]}),
                    new TableRow({ children: [
                        new TableCell({ children: [createPara(lbl.prereq, { font: tableHeaderStyle })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [createPara(lbl.coreq, { font: tableHeaderStyle })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [createPara(lbl.status, { font: tableHeaderStyle })], width: { size: 40, type: WidthType.PERCENTAGE } }),
                    ]}),
                    new TableRow({ children: [
                        new TableCell({ children: [createPara(c.prerequisites.length > 0 ? resolveCodes(c.prerequisites) : 'N/A', { font: tableBodyStyle })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [createPara(c.coRequisites.length > 0 ? resolveCodes(c.coRequisites) : 'N/A', { font: tableBodyStyle })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                        new TableCell({ children: [createPara(statusText, { font: tableBodyStyle })], width: { size: 40, type: WidthType.PERCENTAGE } }),
                    ]})
                ]
            }));
            section11Children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

            // Table 3: Topics
            section11Children.push(createPara(lbl.topics, { font: { ...headerStyle, size: 24 }, para: { alignment: AlignmentType.CENTER, spacing: { before: 100 } } }));
            const topicRows = c.topics.map(t => {
                const totalHours = (t.activities || []).reduce((s, a) => s + a.hours, 0);
                const readings = (t.readingRefs || []).map(r => {
                    const tbIdx = books.findIndex(x => x.resourceId === r.resourceId);
                    if (tbIdx >= 0) return `[TEXT ${tbIdx+1}]`;
                    const refIdx = refs.findIndex(x => x.resourceId === r.resourceId);
                    if (refIdx >= 0) return `[REF ${refIdx+1}]`;
                    return '';
                }).filter(Boolean).join(', ');
                return [t.no, `${totalHours} hrs`, t.topic[language], readings];
            });
            section11Children.push(createTable([lbl.contentNo, lbl.time, lbl.topic, lbl.readings], topicRows, [10, 15, 45, 30]));
            section11Children.push(new Paragraph({ text: "", spacing: { after: 100 } }));

            // Table 4: Assessment
            section11Children.push(createPara(lbl.assessment, { font: { ...headerStyle, size: 24 }, para: { alignment: AlignmentType.CENTER } }));
            const assessRows = c.assessmentPlan.map(a => [a.type[language], `${a.percentile}%`]);
            assessRows.push([lbl.total, "100%"]);
            section11Children.push(createTable([lbl.assessmentType, lbl.percentile], assessRows, [70, 30]));
            section11Children.push(new Paragraph({ text: "", spacing: { after: 100 } }));

            // CLOs
            section11Children.push(createPara(lbl.clos, { font: { ...headerStyle, size: 24 } }));
            section11Children.push(createPara(lbl.closIntro, { font: bodyStyle, para: { spacing: { after: 100 } } }));
            (c.clos[language] || []).forEach((clo, i) => {
                section11Children.push(createPara(`CLO.${i+1} ${clo}`, { font: bodyStyle, para: { indent: { left: 720 } } }));
            });
            section11Children.push(new Paragraph({ text: "", spacing: { after: 200 } }));

            // Table 5: Matrix (CLO - SO)
            section11Children.push(createPara(lbl.relationship, { font: { ...headerStyle, size: 24 }, para: { alignment: AlignmentType.CENTER, spacing: { before: 100 } } }));
            const matrixBody2 = (c.clos[language] || []).map((_, i) => {
                const map = c.cloMap?.find(m => m.cloIndex === i) || { topicIds: [], teachingMethodIds: [], assessmentMethodIds: [], coverageLevel: '', soIds: [], piIds: [] };
                
                const topicNos = map.topicIds.map(tid => c.topics.find(t => t.id === tid)?.no).filter(Boolean).join(', ');
                const methods = map.teachingMethodIds.map(mid => teachingMethods.find(m => m.id === mid)?.code).filter(Boolean).join(', ');
                const assess = map.assessmentMethodIds.map(aid => assessmentMethods.find(m => m.id === aid)?.name[language]).filter(Boolean).join(', ');
                
                // SO mapping logic (SO code + PI codes)
                const soCodes = map.soIds.map(sid => {
                    const s = sos.find(so => so.id === sid);
                    if (!s) return '';
                    const soCode = s.code.replace('SO-', '');
                    const relatedPis = (s.pis || []).filter(pi => (map.piIds || []).includes(pi.id));
                    if (relatedPis.length > 0) {
                        const piCodes = relatedPis.map(pi => pi.code).join(', ');
                        return `${soCode} (${piCodes})`;
                    }
                    return soCode;
                }).filter(Boolean).join(', ');

                return [`CLO.${i+1}`, topicNos || "", methods || "", assess || "", map.coverageLevel || "", soCodes || ""];
            });
            section11Children.push(createTable([lbl.cloCol, lbl.topicCol, lbl.methodCol, lbl.assessCol, lbl.levelCol, lbl.soCol], matrixBody2, [10, 20, 20, 25, 10, 15]));
            section11Children.push(new Paragraph({ text: "", spacing: { after: 300 } }));
        });


        // --- MATRIX Content ---
        const matrixHeaders = ['Mã HP', 'Tên học phần', 'TC', ...sortedObjectives.map(o => getObjectiveLabel(o.id))];
        const matrixWidths = [15, 35, 5, ...sortedObjectives.map(() => 45 / sortedObjectives.length)];
        const matrixRows = [...courses].sort((a,b) => a.semester - b.semester || a.code.localeCompare(b.code)).map(c => {
            const row = [c.code, c.name[language], c.credits.toString()];
            sortedObjectives.forEach(obj => {
                const key = `${c.id}|${obj.id}`;
                const isImplied = impliedCourseObjectiveLinks.has(key);
                const isManual = (moetInfo.courseObjectiveMap || []).includes(key);
                row.push(isImplied || isManual ? "X" : "");
            });
            return row;
        });


        const doc = new Document({
             sections: [{
                properties: {},
                children: [
                    // Header
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE } },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [
                                        createPara("BỘ GIÁO DỤC VÀ ĐÀO TẠO", { font: { ...headerStyle, bold: false }, para: { alignment: AlignmentType.CENTER } }),
                                        createPara(generalInfo.university[language].toUpperCase(), { font: headerStyle, para: { alignment: AlignmentType.CENTER } })
                                    ] }),
                                    new TableCell({ children: [
                                        createPara("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", { font: headerStyle, para: { alignment: AlignmentType.CENTER } }),
                                        createPara("Độc lập - Tự do - Hạnh phúc", { font: { ...headerStyle, bold: false }, para: { alignment: AlignmentType.CENTER } })
                                    ] })
                                ]
                            })
                        ]
                    }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),
                    createPara("CHƯƠNG TRÌNH ĐÀO TẠO", { font: titleStyle, para: { alignment: AlignmentType.CENTER } }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    new Table({
                        width: { size: 70, type: WidthType.PERCENTAGE },
                        alignment: AlignmentType.CENTER,
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                            insideVertical: { style: BorderStyle.NONE },
                            insideHorizontal: { style: BorderStyle.NONE },
                        },
                        rows: [
                            ...[
                                ["Trình độ đào tạo:", moetInfo.level?.[language]],
                                ["Ngành đào tạo:", moetInfo.majorName?.[language]],
                                ["Mã ngành:", moetInfo.majorCode],
                                ["Chuyên ngành:", moetInfo.specializationName?.[language] || "N/A"],
                                ["Mã chuyên ngành:", moetInfo.specializationCode || "N/A"],
                                ["Hình thức đào tạo:", `${moetInfo.trainingMode?.[language] || ""}, ${moetInfo.trainingType?.[language] || ""}`.trim()],
                                ["Ngôn ngữ đào tạo:", moetInfo.trainingLanguage?.[language]]
                            ].map(([label, value]) => new TableRow({
                                children: [
                                    // Cột 1: Nhãn (Căn phải) - Chiếm 45%
                                    new TableCell({ 
                                        children: [createPara(label, { font: bodyStyle, para: { alignment: AlignmentType.RIGHT } })], 
                                        width: { size: 45, type: WidthType.PERCENTAGE } 
                                    }),
                                    
                                    // Cột 2: Cột đệm (Tab) - Chiếm 5%
                                    new TableCell({ 
                                        children: [], 
                                        width: { size: 5, type: WidthType.PERCENTAGE } 
                                    }),
                    
                                    // Cột 3: Giá trị (Căn trái) - Chiếm 50%
                                    new TableCell({ 
                                        children: [createPara(value || "", { font: { ...bodyStyle, bold: true }, para: { alignment: AlignmentType.LEFT } })], 
                                        width: { size: 50, type: WidthType.PERCENTAGE } 
                                    }),
                                ],
                            }))
                        ],
                    }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 1. Objectives
                    createPara("1. Mục tiêu đào tạo", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    createPara("1.1. Mục tiêu chung", { font: styles.h2, para: { heading: HeadingLevel.HEADING_2 } }),
                    ...convertHtmlToDocx(moetInfo.generalObjectives[language]),
                    createPara("1.2. Mục tiêu cụ thể", { font: styles.h2, para: { heading: HeadingLevel.HEADING_2 } }),
                    ...(moetInfo.moetSpecificObjectives || []).map((o, i) => createPara(`${i+1}. ${o.description[language]}`, { font: bodyStyle })),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 2. Learning Outcomes
                    createPara("2. Chuẩn đầu ra", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    ...sortedObjectives.map(o => createPara(`${getObjectiveLabel(o.id)}. ${o.description[language]}`, { font: bodyStyle })),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 3 & 4
                    createPara(`3. Thời gian đào tạo: ${moetInfo.duration}`, { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    createPara(`4. Khối lượng kiến thức toàn khóa: ${totalCreditsCount} tín chỉ`, { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 5, 6, 7
                    createPara("5. Đối tượng tuyển sinh", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    ...convertHtmlToDocx(moetInfo.admissionTarget[language]),
                    createPara("6. Quy trình đào tạo, điều kiện tốt nghiệp", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    ...convertHtmlToDocx(moetInfo.graduationReq[language]),
                    createPara("7. Thang điểm", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    ...convertHtmlToDocx(moetInfo.gradingScale[language]),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 8. Content
                    createPara("8. Nội dung chương trình", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    ...section8Children,
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 9. Faculty
                    createPara("9. Danh sách giảng viên", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    createTable(
                        ["STT", "Họ Tên", "Chức vụ", "Trình độ", "Chức trách"],
                        (moetInfo.programFaculty || []).map((f, i) => [(i+1).toString(), f.name, f.position, f.degree, f.responsibility]),
                        [10, 30, 20, 15, 25]
                    ),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 10. Matrix
                    createPara("10. Ma trận chuẩn đầu ra", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    createTable(matrixHeaders, matrixRows, matrixWidths),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 11. Syllabi
                    createPara("11. Đề cương chi tiết các học phần", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    ...section11Children,
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 12. Referenced Programs
                    createPara("12. Các chương trình đào tạo được tham khảo", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    ...convertHtmlToDocx(moetInfo.referencedPrograms[language]),
                    new Paragraph({ text: "", spacing: { after: 200 } }),

                    // 13. Guidelines
                    createPara("13. Hướng dẫn thực hiện chương trình", { font: styles.h1, para: { heading: HeadingLevel.HEADING_1 } }),
                    ...convertHtmlToDocx(moetInfo.implementationGuideline[language]),
                    new Paragraph({ text: "", spacing: { after: 400 } }),

                    // Signatures Block
                    new Table({
                        width: { size: 50, type: WidthType.PERCENTAGE }, // Bảng rộng 50%
                        alignment: AlignmentType.RIGHT,                 // Toàn bộ bảng căn lề trái trang giấy
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                            insideVertical: { style: BorderStyle.NONE },
                            insideHorizontal: { style: BorderStyle.NONE },
                        },
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        children: [
                                            // Tên trường - Căn giữa trong ô
                                            new Paragraph({
                                                children: [new TextRun({ 
                                                    text: generalInfo.university[language].toUpperCase(), 
                                                    ...headerStyle 
                                                })],
                                                alignment: AlignmentType.CENTER,
                                                spacing: { after: 100 }
                                            }),
                                            // Chức vụ - Căn giữa trong ô
                                            new Paragraph({
                                                children: [new TextRun({ 
                                                    text: language === 'vi' ? "GIÁM ĐỐC" : "PROVOST", 
                                                    ...headerStyle 
                                                })],
                                                alignment: AlignmentType.CENTER
                                            })
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                ]
            }]
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `MOET_Program_${(generalInfo.programName[language] || "Program").replace(/\s+/g, '_')}.docx`;
        link.click();
    } catch (e) {
        console.error(e);
        alert("Export DOCX Failed: " + (e instanceof Error ? e.message : String(e)));
    }
};
