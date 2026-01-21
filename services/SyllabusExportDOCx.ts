
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel, VerticalAlign } from "docx";
import { Course, AssessmentMethod, Language, GeneralInfo, Faculty, TeachingMethod, SO } from '../types';

const htmlToPdfText = (html: string) => {
    if (!html) return "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    let text = tempDiv.textContent || "";
    return text.replace(/\n\s*\n/g, "\n\n").trim(); // Simple text extraction for docx for now
};

export const exportSyllabusDocx = async (
    course: Course,
    assessmentMethods: AssessmentMethod[],
    language: Language,
    generalInfo: GeneralInfo,
    faculties: Faculty[],
    teachingMethods: TeachingMethod[],
    sos: SO[]
) => {
    const labels = language === 'vi' ? {
        creditHours: "Số tín chỉ", instructorInfo: "Thông tin Giảng viên", classInfo: "Thông tin Lớp học",
        textbook: "Giáo trình", references: "Tài liệu tham khảo", description: "Mô tả học phần",
        program: "Chương trình đào tạo", prereq: "Tiên quyết", coreq: "Song hành", status: "Loại hình",
        required: "Bắt buộc (R)", selectedElective: "Tự chọn định hướng (SE)", elective: "Tự chọn tự do (E)",
        topics: "NỘI DUNG ĐỀ MỤC & THỜI KHÓA", contentNo: "STT", time: "Thời lượng", topic: "Nội dung", readings: "Tài liệu đọc",
        assessment: "KẾ HOẠCH ĐÁNH GIÁ", assessmentType: "Hình thức", percentile: "Tỷ lệ", total: "Tổng cộng",
        clos: "CHUẨN ĐẦU RA HỌC PHẦN (CLOs)", closIntro: "Sau khi hoàn thành học phần này, sinh viên có khả năng:",
        relationship: "MA TRẬN QUAN HỆ GIỮA CĐR HỌC PHẦN (CLOs) VÀ CĐR CHƯƠNG TRÌNH (SOs)",
        cloCol: "CĐR Học phần", topicCol: "Nội dung", methodCol: "Phương pháp giảng dạy", assessCol: "Hình thức đánh giá", levelCol: "Mức độ", soCol: "CĐR Chương trình",
        credit: "tín chỉ",
        legend: "Ghi chú: Mức độ đáp ứng: L = Thấp, M = Trung bình, và H = Cao.",
        head: "TRƯỞNG BỘ MÔN", lecturer: "GIẢNG VIÊN BIÊN SOẠN"
    } : {
        creditHours: "No. of Credit Hours", instructorInfo: "Instructor Information", classInfo: "Class Information",
        textbook: "Textbook", references: "Reference Materials", description: "Course Description",
        program: "Academic Program", prereq: "Prerequisite(s)", coreq: "Co-requisite(s)", status: "Course Status",
        required: "Required (R)", selectedElective: "Selected Elective (SE)", elective: "Elective (E)",
        topics: "COURSE TOPICS & SCHEDULES", contentNo: "Content No.", time: "Amount of Time", topic: "Course Topic", readings: "Readings",
        assessment: "COURSE ASSESSMENT PLAN", assessmentType: "Assessment Type", percentile: "Grade Percentile", total: "Total",
        clos: "COURSE LEARNING OUTCOMES (CLOs)", closIntro: "Upon completion of this course, the student should be able to:",
        relationship: "RELATIONSHIP BETWEEN CLOs AND SOs",
        cloCol: "CLO", topicCol: "Topics", methodCol: "Methodology", assessCol: "Assessment", levelCol: "Level", soCol: "SO",
        credit: "credit(s)",
        legend: "Legend: Response level: L = Low, M = Medium, and H = High.",
        head: "HEAD OF DEPARTMENT", lecturer: "LECTURER"
    };

    const styles = {
        header: { font: "Times New Roman", size: 24, bold: true }, // 12pt
        body: { font: "Times New Roman", size: 22 }, // 11pt
        tableHeader: { font: "Times New Roman", size: 22, bold: true },
    };

    const createPara = (text: string, options: any = {}) => new Paragraph({ 
        children: [new TextRun({ text, ...options.font })], 
        ...options.para 
    });

    const mainInstructorId = course.instructorIds.find(id => course.instructorDetails[id]?.isMain) || course.instructorIds[0];
    const faculty = faculties.find(f => f.id === mainInstructorId);
    const instructorInfoStr = faculty ? `${faculty.name[language]}\nOffice: ${faculty.office || ''}\nEmail: ${faculty.email || ''}` : "N/A";
    const classInfoStr = mainInstructorId && course.instructorDetails[mainInstructorId]?.classInfo || "N/A";

    const methodHours: Record<string, number> = {};
    course.topics.forEach(t => { t.activities.forEach(a => { methodHours[a.methodId] = (methodHours[a.methodId] || 0) + a.hours; }); });
    const creditDetails = Object.entries(methodHours).map(([mid, hours]) => {
        const method = teachingMethods.find(tm => tm.id === mid);
        if (!method) return null;
        const factor = method.hoursPerCredit || 15;
        const val = Math.ceil(hours / factor); return val > 0 ? `${method.code}: ${val}` : null;
    }).filter(Boolean).join(', ');
    const creditString = `${course.credits} ${labels.credit}${creditDetails ? ` (${creditDetails})` : ''}`;

    const textbooks = course.textbooks.filter(t => t.type === 'textbook');
    const refs = course.textbooks.filter(t => t.type === 'reference');

    const statusText = `${course.type === 'REQUIRED' ? '[x]' : '[ ]'} ${labels.required}\n${course.type === 'SELECTED_ELECTIVE' ? '[x]' : '[ ]'} ${labels.selectedElective}\n${course.type === 'ELECTIVE' ? '[x]' : '[ ]'} ${labels.elective}`;

    const today = new Date();
    const dateStr = language === 'vi' 
        ? `Đà Nẵng, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`
        : `Da Nang, ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                createPara(`${course.code} - ${(course.name[language] || "").toUpperCase()}`, { font: styles.header, para: { heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT } }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Info Table
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(labels.creditHours, { font: styles.tableHeader })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.instructorInfo, { font: styles.tableHeader })], width: { size: 45, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.classInfo, { font: styles.tableHeader })], width: { size: 35, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                        ]}),
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(creditString, { font: styles.body })] }),
                            new TableCell({ children: [createPara(instructorInfoStr, { font: styles.body })] }),
                            new TableCell({ children: [createPara(classInfoStr, { font: styles.body })] }),
                        ]})
                    ]
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Textbooks & References
                createPara(labels.textbook + ":", { font: styles.header }),
                ...(textbooks.length > 0 
                    ? textbooks.map((tb, i) => createPara(`${i + 1}. ${tb.author} (${tb.year}). ${tb.title}. ${tb.publisher}.`, { font: styles.body }))
                    : [createPara("N/A", { font: styles.body })]
                ),
                new Paragraph({ text: "", spacing: { after: 100 } }),
                createPara(labels.references + ":", { font: styles.header }),
                ...(refs.length > 0 
                    ? refs.map((ref, i) => createPara(`${i + 1}. ${ref.author} (${ref.year}). ${ref.title}. ${ref.publisher}.`, { font: styles.body }))
                    : [createPara("N/A", { font: styles.body })]
                ),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Description
                createPara(labels.description + ":", { font: styles.header }),
                createPara(htmlToPdfText(course.description[language]), { font: styles.body }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Program Context
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(`${labels.program}: ${generalInfo.programName[language] || ""}`, { font: styles.tableHeader, para: { alignment: AlignmentType.CENTER } })], columnSpan: 3, shading: { fill: "E0E0E0" } })
                        ]}),
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(labels.prereq, { font: styles.tableHeader })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                            new TableCell({ children: [createPara(labels.coreq, { font: styles.tableHeader })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                            new TableCell({ children: [createPara(labels.status, { font: styles.tableHeader })], width: { size: 40, type: WidthType.PERCENTAGE } }),
                        ]}),
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(course.prerequisites.join(', ') || 'N/A', { font: styles.body })] }),
                            new TableCell({ children: [createPara(course.coRequisites.join(', ') || 'N/A', { font: styles.body })] }),
                            new TableCell({ children: [createPara(statusText, { font: styles.body })] }),
                        ]})
                    ]
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Topics
                createPara(labels.topics, { font: styles.header, para: { alignment: AlignmentType.CENTER, spacing: { after: 200 } } }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(labels.contentNo, { font: styles.tableHeader })], width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.time, { font: styles.tableHeader })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.topic, { font: styles.tableHeader })], width: { size: 45, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.readings, { font: styles.tableHeader })], width: { size: 30, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                        ]}),
                        ...course.topics.map(t => {
                            const totalHours = (t.activities || []).reduce((s, a) => s + a.hours, 0);
                            const readings = (t.readingRefs || []).map(r => {
                                const tbIdx = textbooks.findIndex(x => x.resourceId === r.resourceId);
                                if (tbIdx >= 0) return `[TEXT ${tbIdx+1}]`;
                                const refIdx = refs.findIndex(x => x.resourceId === r.resourceId);
                                if (refIdx >= 0) return `[REF ${refIdx+1}]`;
                                return '';
                            }).filter(Boolean).join(', ');

                            return new TableRow({
                                children: [
                                    new TableCell({ children: [createPara(t.no, { font: styles.body, para: { alignment: AlignmentType.CENTER } })] }),
                                    new TableCell({ children: [createPara(`${totalHours} hrs`, { font: styles.body, para: { alignment: AlignmentType.CENTER } })] }),
                                    new TableCell({ children: [createPara(t.topic[language], { font: styles.body })] }),
                                    new TableCell({ children: [createPara(readings, { font: styles.body })] }),
                                ]
                            });
                        })
                    ]
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // Assessment
                createPara(labels.assessment, { font: styles.header, para: { spacing: { after: 200 } } }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(labels.assessmentType, { font: { ...styles.body, bold: true } })], width: { size: 70, type: WidthType.PERCENTAGE } }),
                            new TableCell({ children: [createPara(labels.percentile, { font: { ...styles.body, bold: true } })], width: { size: 30, type: WidthType.PERCENTAGE } }),
                        ]}),
                        ...course.assessmentPlan.map(a => {
                            const method = assessmentMethods.find(m => m.id === a.methodId);
                            const defaultName = method ? method.name[language] : '';
                            const customName = a.type[language];
                            
                            let displayName = defaultName;
                            if (customName && customName.trim() !== '' && customName.trim().toLowerCase() !== defaultName.toLowerCase()) {
                                displayName = `${defaultName}, ${customName}`;
                            }

                            return new TableRow({
                                children: [
                                    new TableCell({ children: [createPara(displayName, { font: styles.body })] }),
                                    new TableCell({ children: [createPara(`${a.percentile}%`, { font: styles.body })] }),
                                ]
                            });
                        }),
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(labels.total, { font: { ...styles.body, bold: true } })] }),
                            new TableCell({ children: [createPara("100%", { font: { ...styles.body, bold: true } })] }),
                        ]})
                    ]
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),

                // CLOs
                createPara(labels.clos, { font: styles.header }),
                createPara(labels.closIntro, { font: styles.body, para: { spacing: { after: 100 } } }),
                ...(course.clos[language] || []).map((clo, i) => 
                    createPara(`CLO.${i + 1}  ${clo}`, { font: styles.body, para: { indent: { left: 720 } } })
                ),
                
                // Matrix (CLO - SO) Table
                new Paragraph({ text: "", spacing: { after: 200 } }),
                createPara(labels.relationship, { font: styles.header, para: { alignment: AlignmentType.CENTER, spacing: { after: 200 } } }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [
                            new TableCell({ children: [createPara(labels.cloCol, { font: styles.tableHeader })], width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.topicCol, { font: styles.tableHeader })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.methodCol, { font: styles.tableHeader })], width: { size: 20, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.assessCol, { font: styles.tableHeader })], width: { size: 25, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.levelCol, { font: styles.tableHeader })], width: { size: 10, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                            new TableCell({ children: [createPara(labels.soCol, { font: styles.tableHeader })], width: { size: 15, type: WidthType.PERCENTAGE }, shading: { fill: "E0E0E0" } }),
                        ]}),
                        ...(course.clos[language] || []).map((_, i) => {
                            const map = course.cloMap?.find(m => m.cloIndex === i) || { topicIds: [], teachingMethodIds: [], assessmentMethodIds: [], coverageLevel: '', soIds: [], piIds: [] };
                            
                            const topicNos = map.topicIds.map(tid => course.topics.find(t => t.id === tid)?.no).filter(Boolean).join(', ');
                            const methods = map.teachingMethodIds.map(mid => teachingMethods.find(m => m.id === mid)?.code).filter(Boolean).join(', ');
                            const assess = map.assessmentMethodIds.map(aid => assessmentMethods.find(m => m.id === aid)?.name[language]).filter(Boolean).join(', ');
                            
                            const levelMap: Record<string, string> = { 'I': 'L', 'R': 'M', 'M': 'H' };
                            const displayLevel = levelMap[map.coverageLevel as string] || map.coverageLevel || "";

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

                            return new TableRow({
                                children: [
                                    new TableCell({ children: [createPara(`CLO.${i+1}`, { font: styles.body, para: { alignment: AlignmentType.CENTER } })] }),
                                    new TableCell({ children: [createPara(topicNos, { font: styles.body, para: { alignment: AlignmentType.CENTER } })] }),
                                    new TableCell({ children: [createPara(methods, { font: styles.body, para: { alignment: AlignmentType.CENTER } })] }),
                                    new TableCell({ children: [createPara(assess, { font: styles.body, para: { alignment: AlignmentType.CENTER } })] }),
                                    new TableCell({ children: [createPara(displayLevel, { font: styles.body, para: { alignment: AlignmentType.CENTER } })] }),
                                    new TableCell({ children: [createPara(soCodes, { font: styles.body, para: { alignment: AlignmentType.CENTER } })] }),
                                ]
                            });
                        })
                    ]
                }),

                // Add Matrix Legend
                new Paragraph({ text: "", spacing: { after: 200 } }),
                createPara(labels.legend, { font: { ...styles.body, italics: true, size: 20 } }),
                new Paragraph({ text: "", spacing: { after: 400 } }),

                // Signatures
                new Paragraph({ 
                    children: [new TextRun({ text: dateStr, font: "Times New Roman", size: 22, bold: true })], 
                    alignment: AlignmentType.RIGHT,
                    spacing: { after: 200 } 
                }),

                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE } },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [createPara(labels.head, { font: styles.tableHeader, para: { alignment: AlignmentType.CENTER } })], width: { size: 50, type: WidthType.PERCENTAGE } }),
                                new TableCell({ children: [createPara(labels.lecturer, { font: styles.tableHeader, para: { alignment: AlignmentType.CENTER } })], width: { size: 50, type: WidthType.PERCENTAGE } }),
                            ]
                        })
                    ]
                })
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Syllabus_${course.code}.docx`;
    link.click();
};
