
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Course, Faculty, GeneralInfo, Language, MoetInfo, MoetObjective, TeachingMethod, AssessmentMethod, SO, MoetCategory } from '../types';

const CATEGORY_ORDER: MoetCategory[] = ['knowledge', 'skills', 'attitude', 'learning'];
const CATEGORY_LABELS = {
  knowledge: { vi: 'Kiến thức', en: 'Knowledge' },
  skills: { vi: 'Kỹ năng', en: 'Skills' },
  attitude: { vi: 'Thái độ', en: 'Attitude' },
  learning: { vi: 'Năng lực tự chủ & Trách nhiệm', en: 'Autonomy & Responsibility' }
};

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

export const exportMoetPdf = async (
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
    try {
          const doc = new jsPDF();
          const fontUrlRegular = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
          const fontUrlBold = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';
          
          const [bufferRegular, bufferBold] = await Promise.all([
              fetch(fontUrlRegular).then(res => res.arrayBuffer()),
              fetch(fontUrlBold).then(res => res.arrayBuffer())
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
          
          doc.setFont('Roboto'); 
          
          const centerText = (text: string, y: number, size: number = 13, font: 'bold' | 'normal' = 'normal') => {
              doc.setFontSize(size); doc.setFont('Roboto', font);
              doc.text(text, 105, y, { align: 'center' });
          };
          let y = 20;
          doc.setFontSize(13); doc.setFont('Roboto', 'bold');
          doc.text("BỘ GIÁO DỤC VÀ ĐÀO TẠO", 40, y, { align: 'center' });
          doc.text("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", 160, y, { align: 'center' });
          y += 6;
          doc.text(generalInfo.university[language].toUpperCase(), 40, y, { align: 'center' });
          doc.setFont('Roboto', 'normal'); 
          doc.text("Độc lập - Tự do - Hạnh phúc", 160, y, { align: 'center' });
          y += 2; doc.setLineWidth(0.5); doc.line(25, y, 55, y); doc.line(145, y, 175, y); y += 25;
          centerText("CHƯƠNG TRÌNH ĐÀO TẠO", y, 16, 'bold');
          y += 10; centerText(`(Ban hành theo Quyết định số.................... ngày.... tháng.... năm....`, y, 13, 'normal');
          y += 6; centerText(`của Giám đốc ${generalInfo.university[language]})`, y, 13, 'normal'); y += 20;
          const infoXLabel = 40; const infoXVal = 90;
          const addInfoRow = (label: string, value: string) => {
              doc.setFont('Roboto', 'normal'); doc.setFontSize(13); doc.text(label, infoXLabel, y);
              doc.setFont('Roboto', 'bold'); doc.text(value || "", infoXVal, y); y += 8;
          };
          addInfoRow("Trình độ đào tạo:", moetInfo.level[language]);
          addInfoRow("Ngành đào tạo:", moetInfo.majorName[language]);
          addInfoRow("Mã ngành:", moetInfo.majorCode);
          addInfoRow("Chuyên ngành:", moetInfo.specializationName[language] || "N/A");
          addInfoRow("Mã chuyên ngành:", moetInfo.specializationCode || "N/A");
          addInfoRow("Hình thức đào tạo:", moetInfo.trainingMode[language]);
          addInfoRow("Phương thức đào tạo:", moetInfo.trainingType[language]);
          addInfoRow("Ngôn ngữ đào tạo:", moetInfo.trainingLanguage[language]);
          y += 10;
          const printSectionHeader = (title: string) => {
              if (y > 275) { doc.addPage(); y = 20; }
              doc.setFont('Roboto', 'bold'); doc.setFontSize(13); doc.text(title, 14, y); y += 7;
          };
          const printSectionContent = (content: string) => {
              doc.setFont('Roboto', 'normal'); doc.setFontSize(13);
              const clean = htmlToPdfText(content);
              const split = doc.splitTextToSize(clean || "", 180);
              // Line-by-line printing to handle page breaks naturally
              const lineHeight = 6;
              for (let i = 0; i < split.length; i++) {
                  if (y > 275) { doc.addPage(); y = 20; }
                  doc.text(split[i], 14, y); 
                  y += lineHeight;
              }
              y += 2;
          };
          printSectionHeader("1. Mục tiêu đào tạo");
          printSectionHeader("1.1. Mục tiêu chung");
          printSectionContent(moetInfo.generalObjectives[language]);
          
          printSectionHeader("1.2. Mục tiêu cụ thể");
          (moetInfo.moetSpecificObjectives || []).forEach((obj, idx) => {
              const text = `${idx + 1}. ${obj.description[language]}`;
              const split = doc.splitTextToSize(text, 170); 
              if (y + split.length * 6 > 275) { doc.addPage(); y = 20; }
              doc.text(split, 20, y); 
              y += split.length * 6 + 2;
          });

          y += 5;
          printSectionHeader("2. Chuẩn đầu ra");
          CATEGORY_ORDER.forEach(cat => {
              const meta = CATEGORY_LABELS[cat];
              const objs = sortedObjectives.filter(o => o.category === cat);
              if (objs.length > 0) {
                  if (y > 270) { doc.addPage(); y = 20; }
                  doc.setFont('Roboto', 'bold'); doc.text(`• ${language === 'vi' ? meta.vi : meta.en}`, 14, y); y += 6;
                  doc.setFont('Roboto', 'normal');
                  objs.forEach(o => {
                      const getObjectiveLabel = (id: string) => {
                          const index = sortedObjectives.findIndex(ob => ob.id === id);
                          if (index === -1) return '?';
                          const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                          if (index < letters.length) return letters[index];
                          return letters[index % letters.length] + Math.floor(index / letters.length);
                      };
                      const label = getObjectiveLabel(o.id); const text = `${label}. ${o.description[language]}`;
                      const split = doc.splitTextToSize(text, 170); 
                      if (y + split.length * 6 > 275) { doc.addPage(); y = 20; }
                      doc.text(split, 20, y); 
                      y += split.length * 6 + 2;
                  });
                  y += 4;
              }
          });
          printSectionHeader(`3. Thời gian đào tạo: ${moetInfo.duration}`);
          
          // Calculate total credits based on Program Structure (Module 9)
          const calculateStructureCredits = () => {
              let total = 0;
              const structure = moetInfo.programStructure || { gen: [], fund: [], spec: [], grad: [] };
              
              // 1. Compulsory Courses in main blocks
              ['gen', 'fund', 'spec', 'grad'].forEach(blockKey => {
                  const ids = structure[blockKey as keyof typeof structure] || [];
                  ids.forEach(id => {
                      const c = courses.find(x => x.id === id);
                      if (c) total += c.credits;
                  });
              });

              // 2. Elective Sub-blocks (count minCredits)
              (moetInfo.subBlocks || []).forEach(sb => {
                  total += (sb.minCredits || 0);
              });

              return total;
          };
          
          const totalCreditsCount = calculateStructureCredits();
          printSectionHeader(`4. Khối lượng kiến thức toàn khóa: ${totalCreditsCount} tín chỉ`);
          y += 5;
          printSectionHeader("5. Đối tượng tuyển sinh và chuẩn đầu vào:");
          printSectionContent(moetInfo.admissionTarget[language]);
          printSectionHeader("6. Điều kiện tốt nghiệp:");
          printSectionContent(moetInfo.graduationReq[language]);
          printSectionHeader("7. Thang điểm:");
          printSectionContent(moetInfo.gradingScale[language]);
          if (y > 250) { doc.addPage(); y = 20; }
          
          // --- SECTION 8: PROGRAM CONTENT ---
          printSectionHeader("8. Nội dung chương trình");
          const renderStructureTable = (blockTitle: string, blockIndex: string, idList: string[], parentBlockId: string) => {
              if (y > 250) { doc.addPage(); y = 20; }
              // Main Block Header
              doc.setFont('Roboto', 'bold'); doc.setFontSize(13); doc.text(`${blockIndex}. ${blockTitle}`, 14, y); y += 7;
              
              // 8.x.1. Compulsory Courses
              if (idList) {
                  const subTitle = `${blockIndex}.1. ${language === 'vi' ? 'Học phần bắt buộc' : 'Compulsory Courses'}`;
                  doc.setFont('Roboto', 'bold'); doc.setFontSize(13); doc.text(subTitle, 14, y); y += 6;

                  const directBody = idList.map(id => {
                      const c = courses.find(x => x.id === id);
                      return c ? [c.code || "", c.name[language] || "", c.credits.toString() || "0", "LEC: " + c.credits] : ["", "", "", ""];
                  });

                  // If empty, show one empty row
                  if(directBody.length === 0) directBody.push(["", "", "", ""]);

                  autoTable(doc, {
                      startY: y, head: [['Mã môn', 'Tên môn học', 'Số TC', 'Cụ thể']], body: directBody, theme: 'grid',
                      styles: { font: 'Roboto', fontSize: 11, cellPadding: 3, valign: 'middle' },
                      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center' },
                      columnStyles: { 0: { cellWidth: 30 }, 2: { halign: 'center' }, 3: { halign: 'center' } },
                      margin: { left: 14, right: 14 }
                  });
                  y = (doc as any).lastAutoTable.finalY + 10;
              }

              // 8.x.2. Elective Courses (Sub-blocks)
              const relevantSubBlocks = (moetInfo.subBlocks || []).filter(sb => sb.parentBlockId === parentBlockId);
              if (relevantSubBlocks.length > 0) {
                  if (y > 250) { doc.addPage(); y = 20; }
                  const subTitle = `${blockIndex}.2. ${language === 'vi' ? 'Học phần tự chọn' : 'Elective Courses'}`;
                  doc.setFont('Roboto', 'bold'); doc.setFontSize(13); doc.text(subTitle, 14, y); y += 6;

                  let subBlockBody: any[][] = [];
                  relevantSubBlocks.forEach(sb => {
                      // Sub-block Header Row
                      subBlockBody.push([{ content: `${sb.name[language] || ""} (Min ${sb.minCredits || 0} cr)`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [240, 248, 255] } }]);
                      // Courses in Sub-block
                      sb.courseIds.forEach(cid => {
                          const c = courses.find(x => x.id === cid);
                          if(c) {
                              subBlockBody.push([c.code || "", c.name[language] || "", c.credits.toString() || "0", "LEC: " + c.credits]);
                          }
                      });
                  });

                  autoTable(doc, {
                      startY: y, head: [['Mã môn', 'Tên môn học', 'Số TC', 'Cụ thể']], body: subBlockBody, theme: 'grid',
                      styles: { font: 'Roboto', fontSize: 11, cellPadding: 3, valign: 'middle' },
                      headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center' },
                      columnStyles: { 0: { cellWidth: 30 }, 2: { halign: 'center' }, 3: { halign: 'center' } },
                      margin: { left: 14, right: 14 }
                  });
                  y = (doc as any).lastAutoTable.finalY + 10;
              }
          };

          renderStructureTable(language === 'vi' ? 'Kiến thức giáo dục đại cương' : 'General Education', '8.1', moetInfo.programStructure.gen, 'gen');
          renderStructureTable(language === 'vi' ? 'Kiến thức cơ sở ngành' : 'Fundamental Engineering', '8.2', moetInfo.programStructure.fund, 'fund');
          renderStructureTable(language === 'vi' ? 'Kiến thức chuyên ngành' : 'Specialized Engineering', '8.3', moetInfo.programStructure.spec, 'spec');
          renderStructureTable(language === 'vi' ? 'Tốt nghiệp cuối khóa' : 'Graduation & Internship', '8.4', moetInfo.programStructure.grad, 'grad');
          
          if (y > 250) { doc.addPage(); y = 20; }
          // Section 9
          printSectionHeader("9. Kế hoạch đào tạo");
          printSectionHeader("9.1. Danh sách giảng viên thực hiện chương trình");
          const facultyTableBody = (moetInfo.programFaculty || []).map((f, idx) => [
            (idx + 1).toString(), f.name || "", f.position || "", f.major || "", f.degree || "", f.responsibility || "", f.note || ""
          ]);
          autoTable(doc, {
              startY: y, 
              head: [['STT', 'Họ Và Tên', 'Chức vụ', 'Ngành', 'Trình độ', 'Chức trách', 'Ghi chú']], 
              body: facultyTableBody, 
              theme: 'grid',
              styles: { font: 'Roboto', fontSize: 11, cellPadding: 3 },
              headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center' },
              margin: { left: 14, right: 14 }
          });
          y = (doc as any).lastAutoTable.finalY + 10;
          
          if (y > 250) { doc.addPage(); y = 20; }
          printSectionHeader("9.2. Kế hoạch");
          const sortedCourses = [...courses].sort((a,b) => a.semester - b.semester || a.code.localeCompare(b.code));
          const planBody = sortedCourses.map(c => [ c.code || "", c.name[language] || "", c.credits.toString() || "0", c.semester.toString() || "", "" ]);
          autoTable(doc, {
              startY: y, head: [['Mã Môn', 'Tên Môn', 'Số TC', 'Học kỳ', 'Giảng viên']], body: planBody, theme: 'grid',
              styles: { font: 'Roboto', fontSize: 11, cellPadding: 3 },
              headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', halign: 'center' },
              columnStyles: { 2: { halign: 'center', cellWidth: 30 }, 3: { halign: 'center', cellWidth: 30 } },
              margin: { left: 14, right: 14 }
          });
          y = (doc as any).lastAutoTable.finalY + 10;

          if (y > 250) { doc.addPage(); y = 20; }
          printSectionHeader("10. Mối quan hệ giữa chuẩn đầu ra và các học phần");
          const getObjectiveLabel = (id: string) => {
              const index = sortedObjectives.findIndex(ob => ob.id === id);
              if (index === -1) return '?';
              const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
              if (index < letters.length) return letters[index];
              return letters[index % letters.length] + Math.floor(index / letters.length);
          };
          const objectiveLabels = sortedObjectives.map(o => getObjectiveLabel(o.id));
          const matrixHead = [['Mã HP', 'Tên học phần', 'TC', ...objectiveLabels]];
          const matrixBody = sortedCourses.map(c => {
              const row = [c.code || "", c.name[language] || "", c.credits.toString() || "0"];
              sortedObjectives.forEach(obj => {
                  const key = `${c.id}|${obj.id}`;
                  const isImplied = impliedCourseObjectiveLinks.has(key);
                  const isManual = (moetInfo.courseObjectiveMap || []).includes(key);
                  row.push(isImplied || isManual ? "X" : "");
              });
              return row;
          });
          doc.setFontSize(11); doc.text("Chuẩn đầu ra", 150, y + 5);
          autoTable(doc, {
              startY: y, head: matrixHead, body: matrixBody, theme: 'grid',
              styles: { font: 'Roboto', fontSize: 10, cellPadding: 2, halign: 'center' },
              columnStyles: { 1: { halign: 'left' } },
              headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
              margin: { left: 14, right: 14 }
          });
          y = (doc as any).lastAutoTable.finalY + 10;
          
          if (y > 250) { doc.addPage(); y = 20; }
          printSectionHeader("11. Đề cương chi tiết các học phần");
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
          const lbl = LABELS[language];
          sortedCourses.forEach((c, idx) => {
              if (y > 240) { doc.addPage(); y = 20; }
              const mainInstructorId = c.instructorIds.find(id => c.instructorDetails[id]?.isMain) || c.instructorIds[0];
              const faculty = faculties.find(f => f.id === mainInstructorId);
              const instructorInfoStr = faculty ? `${faculty.name[language]}\nOffice: ${faculty.office || ''}\nEmail: ${faculty.email || ''}` : "N/A";
              const classInfoStr = mainInstructorId && c.instructorDetails[mainInstructorId]?.classInfo || "N/A";
              const resolveCodes = (ids: string[]) => ids.map(id => {
                  const found = courses.find(x => x.id === id || x.code === id);
                  return found ? found.code : id;
              }).join(', ');
              doc.setFont('Roboto', 'bold'); doc.setFontSize(13); doc.text(`11.${idx + 1}. ${c.code || ""} - ${(c.name[language] || "").toUpperCase()}`, 14, y); y += 5;
              const methodHours: Record<string, number> = {};
              c.topics.forEach(t => { t.activities.forEach(a => { methodHours[a.methodId] = (methodHours[a.methodId] || 0) + a.hours; }); });
              const creditDetails = Object.entries(methodHours).map(([mid, hours]) => {
                  const method = teachingMethods.find(tm => tm.id === mid);
                  if (!method) return null;
                  const factor = method.hoursPerCredit || 15;
                  const val = Math.ceil(hours / factor); return val > 0 ? `${method.code}: ${val}` : null;
              }).filter(Boolean).join(', ');
              const creditString = `${c.credits} ${lbl.credit}${creditDetails ? ` (${creditDetails})` : ''}`;
              autoTable(doc, {
                  startY: y, head: [[lbl.creditHours, lbl.instructorInfo, lbl.classInfo]], body: [[creditString, instructorInfoStr, classInfoStr]], theme: 'grid',
                  styles: { font: 'Roboto', fontSize: 11, cellPadding: 2, valign: 'top' },
                  headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' }, margin: { left: 14, right: 14 }
              });
              y = (doc as any).lastAutoTable.finalY + 5;
              doc.setFont('Roboto', 'bold'); doc.setFontSize(12); doc.text(lbl.textbook + ":", 14, y); y += 5;
              doc.setFont('Roboto', 'normal');
              const textbooks = c.textbooks.filter(t => t.type === 'textbook');
              if (textbooks.length === 0) { doc.text("N/A", 20, y); y += 5; } else {
                  textbooks.forEach((tb, i) => {
                      const line = `${i + 1}. ${tb.author} (${tb.year}). ${tb.title}. ${tb.publisher}.`;
                      const split = doc.splitTextToSize(line, 180); doc.text(split, 20, y); y += split.length * 4 + 2;
                  });
              }
              doc.setFont('Roboto', 'bold'); doc.text(lbl.references + ":", 14, y); y += 5;
              doc.setFont('Roboto', 'normal');
              const refs = c.textbooks.filter(t => t.type === 'reference');
              if (refs.length === 0) { doc.text("N/A", 20, y); y += 5; } else {
                  refs.forEach((ref, i) => {
                      const line = `${i + 1}. ${ref.author} (${ref.year}). ${ref.title}. ${ref.publisher}.`;
                      const split = doc.splitTextToSize(line, 180); doc.text(split, 20, y); y += split.length * 4 + 2;
                  });
              }
              doc.setFont('Roboto', 'bold'); doc.text(lbl.description + ":", 14, y); y += 5;
              doc.setFont('Roboto', 'normal');
              const desc = htmlToPdfText(c.description[language]);
              const splitDesc = doc.splitTextToSize(desc || "N/A", 180); doc.text(splitDesc, 20, y); y += splitDesc.length * 4 + 5;
              autoTable(doc, {
                  startY: y, head: [[{ content: `${lbl.program}: ${generalInfo.programName[language] || ""}`, colSpan: 3, styles: { halign: 'center' } }]],
                  body: [
                      [{ content: lbl.prereq, styles: { fontStyle: 'bold' } }, { content: lbl.coreq, styles: { fontStyle: 'bold' } }, { content: lbl.status, styles: { fontStyle: 'bold' } }],
                      [
                          c.prerequisites.length > 0 ? resolveCodes(c.prerequisites) : 'N/A',
                          c.coRequisites.length > 0 ? resolveCodes(c.coRequisites) : 'N/A',
                          `${c.type === 'REQUIRED' ? '[x]' : '[ ]'} ${lbl.required}\n${c.type === 'SELECTED_ELECTIVE' ? '[x]' : '[ ]'} ${lbl.selectedElective}\n${c.type === 'ELECTIVE' ? '[x]' : '[ ]'} ${lbl.elective}`
                      ]
                  ],
                  theme: 'grid', styles: { font: 'Roboto', fontSize: 11, cellPadding: 2, halign: 'center', valign: 'middle' },
                  headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
              });
              y = (doc as any).lastAutoTable.finalY + 5;
              if (y > 230) { doc.addPage(); y = 20; }
              doc.setFont('Roboto', 'bold'); doc.text(lbl.topics, 105, y, { align: 'center' }); y += 5;
              const topicsBody = c.topics.map(t => {
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
              if (y > 230) { doc.addPage(); y = 20; }
              doc.text(lbl.assessment, 105, y, { align: 'center' }); y += 5;
              const assessBody = c.assessmentPlan.map(a => [a.type[language] || "", `${a.percentile}%`]);
              assessBody.push([lbl.total, "100%"]);
              autoTable(doc, {
                  startY: y, head: [[lbl.assessmentType, lbl.percentile]], body: assessBody, theme: 'grid',
                  styles: { font: 'Roboto', fontSize: 11, cellPadding: 2, halign: 'center' },
                  headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
              });
              y = (doc as any).lastAutoTable.finalY + 5;
              if (y > 230) { doc.addPage(); y = 20; }
              doc.setFont('Roboto', 'bold'); doc.text(lbl.clos, 14, y); y += 5;
              doc.setFont('Roboto', 'normal'); doc.text(lbl.closIntro, 14, y); y += 5;
              (c.clos[language] || []).forEach((clo, i) => {
                  const text = `CLO.${i + 1}  ${clo}`;
                  const split = doc.splitTextToSize(text, 180); doc.text(split, 20, y); y += split.length * 4 + 2;
              });
              y += 5;
              if (y > 230) { doc.addPage(); y = 20; }
              doc.setFont('Roboto', 'bold'); doc.text(lbl.relationship, 105, y, { align: 'center' }); y += 5;
              const matrixBody2 = (c.clos[language] || []).map((_, i) => {
                  const map = c.cloMap?.find(m => m.cloIndex === i) || { topicIds: [], teachingMethodIds: [], assessmentMethodIds: [], coverageLevel: '', soIds: [] };
                  const topicNos = map.topicIds.map(tid => c.topics.find(t => t.id === tid)?.no).filter(Boolean).join(', ');
                  const methods = map.teachingMethodIds.map(mid => teachingMethods.find(m => m.id === mid)?.code).filter(Boolean).join(', ');
                  const assess = map.assessmentMethodIds.map(aid => assessmentMethods.find(m => m.id === aid)?.name[language]).filter(Boolean).join(', ');
                  const soCodes = map.soIds.map(sid => sos.find(s => s.id === sid)?.number).filter(Boolean).join(', ');
                  return [`CLO.${i+1}`, topicNos || "", methods || "", assess || "", map.coverageLevel || "", soCodes || ""];
              });
              autoTable(doc, {
                  startY: y, head: [[lbl.cloCol, lbl.topicCol, lbl.methodCol, lbl.assessCol, lbl.levelCol, lbl.soCol]], body: matrixBody2, theme: 'grid',
                  styles: { font: 'Roboto', fontSize: 9, cellPadding: 2, halign: 'center', valign: 'middle' },
                  headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }, margin: { left: 14, right: 14 }
              });
              y = (doc as any).lastAutoTable.finalY + 10;
          });
          if (y > 250) { doc.addPage(); y = 20; }
          printSectionHeader("12. Các chương trình đào tạo được tham khảo");
          printSectionContent(moetInfo.referencedPrograms[language]);
          printSectionHeader("13. Hướng dẫn thực hiện chương trình");
          printSectionContent(moetInfo.implementationGuideline[language]);
          if (y > 240) { doc.addPage(); y = 20; }
          y += 20; doc.setFont('Roboto', 'bold'); doc.setFontSize(13); doc.text(generalInfo.university[language] || "", 150, y, { align: 'center' });
          y += 6; doc.text(language === 'vi' ? "GIÁM ĐỐC" : "PROVOST", 150, y, { align: 'center' });
          doc.save(`MOET_Program_Spec_${(generalInfo.programName[language] || "Program").replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Error generating PDF. Please check internet connection for font loading.");
    }
};
