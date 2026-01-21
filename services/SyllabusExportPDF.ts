import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Course, AssessmentMethod, Language, GeneralInfo, Faculty, TeachingMethod, SO } from '../types';

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

export const exportSyllabusPdf = async (
    course: Course,
    assessmentMethods: AssessmentMethod[],
    language: Language,
    generalInfo: GeneralInfo,
    faculties: Faculty[],
    teachingMethods: TeachingMethod[],
    sos: SO[]
) => {
    try {
        const doc = new jsPDF();
        // Load fonts (reusing logic from Moet export for consistency)
        const fontUrlRegular = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
        const fontUrlBold = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';
        const fontUrlItalic = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Italic.ttf';
        
        const [bufferRegular, bufferBold, bufferItalic] = await Promise.all([
            fetch(fontUrlRegular).then(res => res.arrayBuffer()),
            fetch(fontUrlBold).then(res => res.arrayBuffer()),
            fetch(fontUrlItalic).then(res => res.arrayBuffer())
        ]);
        
        const arrayBufferToBinaryString = (buffer: ArrayBuffer) => {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return binary;
        };
        
        doc.addFileToVFS('Roboto-Regular.ttf', btoa(arrayBufferToBinaryString(bufferRegular)));
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal', 'Identity-H');
        doc.addFileToVFS('Roboto-Bold.ttf', btoa(arrayBufferToBinaryString(bufferBold)));
        doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold', 'Identity-H');
        doc.addFileToVFS('Roboto-Italic.ttf', btoa(arrayBufferToBinaryString(bufferItalic)));
        doc.addFont('Roboto-Italic.ttf', 'Roboto', 'italic', 'Identity-H');
        doc.setFont('Roboto');

        const LABELS = {
            vi: {
              creditHours: "Số tín chỉ", instructorInfo: "Thông tin Giảng viên", classInfo: "Thông tin Lớp học",
              textbook: "Giáo trình", references: "Tài liệu tham khảo", description: "Mô tả học phần",
              program: "Chương trình đào tạo", prereq: "Tiên quyết", coreq: "Song hành", status: "Loại hình",
              required: "Bắt buộc (R)", selectedElective: "Tự chọn định hướng (SE)", elective: "Tự chọn tự do (E)",
              topics: "NỘI DUNG ĐỀ MỤC & THỜI KHÓA", contentNo: "STT", time: "Thời lượng", topic: "Nội dung", readings: "Tài liệu đọc",
              assessment: "KẾ HOẠCH ĐÁNH GIÁ", assessmentType: "Hình thức", percentile: "Tỷ lệ", total: "Tổng cộng",
              clos: "CHUẨN ĐẦU RA HỌC PHẦN (CLOs)", closIntro: "Sau khi hoàn thành học phần này, sinh viên có khả năng:",
              relationship: "MA TRẬN QUAN HỆ GIỮA CĐR HỌC PHẦN (CLOs) VÀ CĐR CHƯƠNG TRÌNH (SOs)",
              cloCol: "CĐR Học phần", topicCol: "Nội dung", methodCol: "Phương pháp giảng dạy", assessCol: "Hình thức đánh giá", levelCol: "Mức độ", soCol: "CĐR Chương trình", credit: "tín chỉ",
              legend: "Ghi chú: Mức độ đáp ứng: L = Thấp, M = Trung bình, và H = Cao.",
              head: "TRƯỞNG BỘ MÔN", lecturer: "GIẢNG VIÊN BIÊN SOẠN"
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
              cloCol: "CLO", topicCol: "Topics", methodCol: "Methodology", assessCol: "Assessment", levelCol: "Level", soCol: "SO", credit: "credit(s)",
              legend: "Legend: Response level: L = Low, M = Medium, and H = High.",
              head: "HEAD OF DEPARTMENT", lecturer: "LECTURER"
            }
        };
        const lbl = LABELS[language];
        let y = 20;

        // Header
        const resolveCodes = (ids: string[]) => ids.map(id => id).join(', '); 
        
        const mainInstructorId = course.instructorIds.find(id => course.instructorDetails[id]?.isMain) || course.instructorIds[0];
        const faculty = faculties.find(f => f.id === mainInstructorId);
        const instructorInfoStr = faculty ? `${faculty.name[language]}\nOffice: ${faculty.office || ''}\nEmail: ${faculty.email || ''}` : "N/A";
        const classInfoStr = mainInstructorId && course.instructorDetails[mainInstructorId]?.classInfo || "N/A";

        doc.setFont('Roboto', 'bold'); doc.setFontSize(13); 
        doc.text(`${course.code || ""} - ${(course.name[language] || "").toUpperCase()}`, 14, y); 
        y += 5;

        // Credits calculation
        const methodHours: Record<string, number> = {};
        course.topics.forEach(t => { t.activities.forEach(a => { methodHours[a.methodId] = (methodHours[a.methodId] || 0) + a.hours; }); });
        const creditDetails = Object.entries(methodHours).map(([mid, hours]) => {
            const method = teachingMethods.find(tm => tm.id === mid);
            if (!method) return null;
            const factor = method.hoursPerCredit || 15;
            const val = Math.ceil(hours / factor); return val > 0 ? `${method.code}: ${val}` : null;
        }).filter(Boolean).join(', ');
        const creditString = `${course.credits} ${lbl.credit}${creditDetails ? ` (${creditDetails})` : ''}`;

        autoTable(doc, {
            startY: y, head: [[lbl.creditHours, lbl.instructorInfo, lbl.classInfo]], body: [[creditString, instructorInfoStr, classInfoStr]], theme: 'grid',
            styles: { font: 'Roboto', fontSize: 11, cellPadding: 2, valign: 'top' },
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' }, margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // Textbooks
        doc.setFont('Roboto', 'bold'); doc.setFontSize(12); doc.text(lbl.textbook + ":", 14, y); y += 5;
        doc.setFont('Roboto', 'normal');
        const textbooks = course.textbooks.filter(t => t.type === 'textbook');
        if (textbooks.length === 0) { doc.text("N/A", 20, y); y += 5; } else {
            textbooks.forEach((tb, i) => {
                const line = `${i + 1}. ${tb.author} (${tb.year}). ${tb.title}. ${tb.publisher}.`;
                const split = doc.splitTextToSize(line, 180); doc.text(split, 20, y); y += split.length * 4 + 2;
            });
        }

        // References
        doc.setFont('Roboto', 'bold'); doc.text(lbl.references + ":", 14, y); y += 5;
        doc.setFont('Roboto', 'normal');
        const refs = course.textbooks.filter(t => t.type === 'reference');
        if (refs.length === 0) { doc.text("N/A", 20, y); y += 5; } else {
            refs.forEach((ref, i) => {
                const line = `${i + 1}. ${ref.author} (${ref.year}). ${ref.title}. ${ref.publisher}.`;
                const split = doc.splitTextToSize(line, 180); doc.text(split, 20, y); y += split.length * 4 + 2;
            });
        }

        // Description
        doc.setFont('Roboto', 'bold'); doc.text(lbl.description + ":", 14, y); y += 5;
        doc.setFont('Roboto', 'normal');
        const desc = htmlToPdfText(course.description[language]);
        const splitDesc = doc.splitTextToSize(desc || "N/A", 180); doc.text(splitDesc, 20, y); y += splitDesc.length * 4 + 5;

        // Program Context Table
        autoTable(doc, {
            startY: y, head: [[{ content: `${lbl.program}: ${generalInfo.programName[language] || ""}`, colSpan: 3, styles: { halign: 'center' } }]],
            body: [
                [{ content: lbl.prereq, styles: { fontStyle: 'bold' } }, { content: lbl.coreq, styles: { fontStyle: 'bold' } }, { content: lbl.status, styles: { fontStyle: 'bold' } }],
                [
                    course.prerequisites.length > 0 ? resolveCodes(course.prerequisites) : 'N/A',
                    course.coRequisites.length > 0 ? resolveCodes(course.coRequisites) : 'N/A',
                    `${course.type === 'REQUIRED' ? '[x]' : '[ ]'} ${lbl.required}\n${course.type === 'SELECTED_ELECTIVE' ? '[x]' : '[ ]'} ${lbl.selectedElective}\n${course.type === 'ELECTIVE' ? '[x]' : '[ ]'} ${lbl.elective}`
                ]
            ],
            theme: 'grid', styles: { font: 'Roboto', fontSize: 11, cellPadding: 2, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // Topics
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setFont('Roboto', 'bold'); doc.text(lbl.topics, 105, y, { align: 'center' }); y += 5;
        const topicsBody = course.topics.map(t => {
            const totalHours = (t.activities || []).reduce((s, a) => s + a.hours, 0);
            const readings = (t.readingRefs || []).map(r => {
                const tbIdx = textbooks.findIndex(x => x.resourceId === r.resourceId);
                if (tbIdx >= 0) return `[TEXT ${tbIdx+1}]`;
                const refIdx = refs.findIndex(x => x.resourceId === r.resourceId);
                if (refIdx >= 0) return `[REF ${refIdx+1}]`;
                return '';
            }).filter(Boolean).join(', ');
            return [t.no || "", `${totalHours} hrs`, t.topic[language] || "", readings || ""];
        });
        autoTable(doc, {
            startY: y, head: [[lbl.contentNo, lbl.time, lbl.topic, lbl.readings]], body: topicsBody, theme: 'grid',
            styles: { font: 'Roboto', fontSize: 11, cellPadding: 2, valign: 'top' },
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
            columnStyles: { 0: { halign: 'center', cellWidth: 20 }, 1: { halign: 'center', cellWidth: 20 }, 3: { cellWidth: 40 } },
            margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // Assessment
        if (y > 230) { doc.addPage(); y = 20; }
        doc.text(lbl.assessment, 105, y, { align: 'center' }); y += 5;
        const assessmentRows = course.assessmentPlan.map(a => {
            const method = assessmentMethods.find(m => m.id === a.methodId);
            const defaultName = method ? method.name[language] : '';
            const customName = a.type[language];
            
            let displayName = defaultName;
            if (customName && customName.trim() !== '' && customName.trim().toLowerCase() !== defaultName.toLowerCase()) {
                displayName = `${defaultName}, ${customName}`;
            }
            return [displayName, `${a.percentile}%`];
        });
        assessmentRows.push([lbl.total, "100%"]);
        autoTable(doc, {
            startY: y, head: [[lbl.assessmentType, lbl.percentile]], body: assessmentRows, theme: 'grid',
            styles: { font: 'Roboto', fontSize: 11, cellPadding: 2, halign: 'center' },
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // CLOs
        if (y > 230) { doc.addPage(); y = 20; }
        doc.setFont('Roboto', 'bold'); doc.text(lbl.clos, 14, y); y += 5;
        doc.setFont('Roboto', 'normal'); doc.text(lbl.closIntro, 14, y); y += 5;
        (course.clos[language] || []).forEach((clo, i) => {
            const text = `CLO.${i + 1}  ${clo}`;
            const split = doc.splitTextToSize(text, 180); doc.text(split, 20, y); y += split.length * 4 + 2;
        });
        y += 5;

        // Matrix
        if (sos && sos.length > 0) {
            if (y > 200) { doc.addPage(); y = 20; }
            doc.setFont('Roboto', 'bold'); doc.text(lbl.relationship, 105, y, { align: 'center' }); y += 5;
            
            const levelMap: Record<string, string> = { 'I': 'L', 'R': 'M', 'M': 'H' };

            const matrixBody2 = (course.clos[language] || []).map((_, i) => {
                const map = course.cloMap?.find(m => m.cloIndex === i) || { topicIds: [], teachingMethodIds: [], assessmentMethodIds: [], coverageLevel: '', soIds: [] };
                const topicNos = map.topicIds.map(tid => course.topics.find(t => t.id === tid)?.no).filter(Boolean).join(', ');
                const methods = map.teachingMethodIds.map(mid => teachingMethods.find(m => m.id === mid)?.code).filter(Boolean).join(', ');
                const assess = map.assessmentMethodIds.map(aid => assessmentMethods.find(m => m.id === aid)?.name[language]).filter(Boolean).join(', ');
                const soCodes = map.soIds.map(sid => sos.find(s => s.id === sid)?.number).filter(Boolean).join(', ');
                
                // Map Coverage Level I/R/M -> L/M/H
                const displayLevel = levelMap[map.coverageLevel as string] || map.coverageLevel || "";

                return [`CLO.${i+1}`, topicNos || "", methods || "", assess || "", displayLevel, soCodes || ""];
            });
            autoTable(doc, {
                startY: y, head: [[lbl.cloCol, lbl.topicCol, lbl.methodCol, lbl.assessCol, lbl.levelCol, lbl.soCol]], body: matrixBody2, theme: 'grid',
                styles: { font: 'Roboto', fontSize: 9, cellPadding: 2, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
            });
            y = (doc as any).lastAutoTable.finalY + 5;
            
            // Add Legend
            doc.setFont('Roboto', 'italic');
            doc.setFontSize(10);
            doc.text(lbl.legend, 14, y);
            y += 15;
        }

        // Signatures
        if (y > 240) { doc.addPage(); y = 20; }
        
        // Date Line
        doc.setFont('Roboto', 'bold');
        doc.setFontSize(11);
        const today = new Date();
        const dateStr = language === 'vi' 
            ? `Đà Nẵng, ngày ${today.getDate()} tháng ${today.getMonth() + 1} năm ${today.getFullYear()}`
            : `Da Nang, ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
        
        doc.text(dateStr, 190, y, { align: 'right' }); 
        y += 10;

        autoTable(doc, {
            startY: y,
            head: [[lbl.head, lbl.lecturer]],
            body: [['', '']],
            theme: 'plain',
            styles: { font: 'Roboto', fontSize: 11, fontStyle: 'bold', halign: 'center', minCellHeight: 30 },
            headStyles: { fontStyle: 'bold', textColor: 0 },
            columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
            margin: { left: 14 }
        });

        doc.save(`Syllabus_${course.code}.pdf`);
    } catch (e) {
        console.error(e);
        throw e;
    }
};