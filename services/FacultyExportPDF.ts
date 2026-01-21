
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Faculty, Language } from '../types';

export const exportFacultyCvPdf = async (faculty: Faculty, language: Language) => {
  const doc = new jsPDF();
  const margin = 15;
  let y = 20;

  // Font setup for Vietnamese support
  const fontUrlRegular = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf';
  const fontUrlBold = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Medium.ttf';
  
  try {
      const [bufferRegular, bufferBold] = await Promise.all([
          fetch(fontUrlRegular).then(res => res.arrayBuffer()),
          fetch(fontUrlBold).then(res => res.arrayBuffer())
      ]);

      const arrayBufferToBinaryString = (buffer: ArrayBuffer) => {
          let binary = '';
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
          return binary;
      };

      doc.addFileToVFS('Roboto-Regular.ttf', btoa(arrayBufferToBinaryString(bufferRegular)));
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFileToVFS('Roboto-Bold.ttf', btoa(arrayBufferToBinaryString(bufferBold)));
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto');

      // --- HELPER FUNCTIONS ---
      
      const checkPageBreak = (heightNeeded: number) => {
          if (y + heightNeeded > 280) {
              doc.addPage();
              y = 20;
          }
      };

      const addSectionHeader = (title: string) => {
          checkPageBreak(15);
          doc.setFontSize(11); 
          doc.setFont('Roboto', 'bold');
          doc.text(title.toUpperCase(), margin, y);
          y += 6;
      };

      const addListItem = (text: string) => {
          doc.setFontSize(10); 
          doc.setFont('Roboto', 'normal');
          const splitText = doc.splitTextToSize(`• ${text}`, 180);
          checkPageBreak(splitText.length * 5 + 2);
          doc.text(splitText, margin, y);
          y += splitText.length * 5 + 2;
      };

      // --- PDF CONTENT GENERATION ---

      // 1. Header (Name & Title)
      doc.setFontSize(16); doc.setFont('Roboto', 'bold');
      doc.text(faculty.name[language].toUpperCase(), 105, y, { align: 'center' });
      y += 7;
      
      doc.setFontSize(10); doc.setFont('Roboto', 'normal');
      const rank = faculty.rank[language] || faculty.rank['en'] || '';
      const degree = faculty.degree[language] || faculty.degree['en'] || '';
      const fullTitle = [rank, degree].filter(Boolean).join(' - ');
      if (fullTitle) {
          doc.text(fullTitle, 105, y, { align: 'center' });
          y += 10;
      }

      // Contact Info Table (Compact)
      autoTable(doc, {
          startY: y,
          head: [[language === 'vi' ? 'Thông tin liên hệ' : 'Contact Information']],
          body: [[ 
              `Email: ${faculty.email || 'N/A'}\n` +
              `Tel: ${faculty.tel || 'N/A'}\n` +
              `Office: ${faculty.office || 'N/A'}` 
          ]],
          theme: 'plain',
          styles: { font: 'Roboto', fontSize: 9, cellPadding: 2 },
          headStyles: { fontStyle: 'bold', fillColor: [240, 240, 240], textColor: 0 }
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // 2. Education
      if (faculty.educationList.length > 0) {
          addSectionHeader(language === 'vi' ? 'Quá trình đào tạo' : 'Education');
          autoTable(doc, {
              startY: y,
              head: [[
                  language === 'vi' ? 'Năm' : 'Year', 
                  language === 'vi' ? 'Bằng cấp' : 'Degree', 
                  language === 'vi' ? 'Nơi đào tạo' : 'Institution'
              ]],
              body: faculty.educationList.map(e => [
                  e.year, 
                  e.degree[language] || e.degree['en'], 
                  e.institution[language] || e.institution['en']
              ]),
              theme: 'grid',
              styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
              headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
          });
          y = (doc as any).lastAutoTable.finalY + 10;
      }

      // 3. Academic Experience
      if (faculty.academicExperienceList.length > 0) {
          checkPageBreak(30);
          addSectionHeader(language === 'vi' ? 'Kinh nghiệm Học thuật' : 'Academic Experience');
          autoTable(doc, {
              startY: y,
              head: [[
                  language === 'vi' ? 'Thời gian' : 'Period', 
                  language === 'vi' ? 'Chức danh' : 'Rank/Title', 
                  language === 'vi' ? 'Nơi công tác' : 'Institution'
              ]],
              body: faculty.academicExperienceList.map(e => [
                  e.period, 
                  e.title[language] || e.title['en'], 
                  e.institution[language] || e.institution['en']
              ]),
              theme: 'grid',
              styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
              headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
          });
          y = (doc as any).lastAutoTable.finalY + 10;
      }

      // 4. Non-Academic Experience
      if (faculty.nonAcademicExperienceList.length > 0) {
          checkPageBreak(30);
          addSectionHeader(language === 'vi' ? 'Kinh nghiệm Khác' : 'Non-Academic Experience');
          autoTable(doc, {
              startY: y,
              head: [[
                  language === 'vi' ? 'Thời gian' : 'Period', 
                  language === 'vi' ? 'Chức danh' : 'Title', 
                  language === 'vi' ? 'Tổ chức/Công ty' : 'Company/Entity'
              ]],
              body: faculty.nonAcademicExperienceList.map(e => [
                  e.period, 
                  e.title[language] || e.title['en'], 
                  e.company[language] || e.company['en']
              ]),
              theme: 'grid',
              styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
              headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold' }
          });
          y = (doc as any).lastAutoTable.finalY + 10;
      }

      // 5. Certifications
      if (faculty.certificationsList && faculty.certificationsList.length > 0) {
          addSectionHeader(language === 'vi' ? 'Chứng chỉ & Đăng ký hành nghề' : 'Certifications or Professional Registrations');
          faculty.certificationsList.forEach(item => {
              addListItem(item.content[language] || item.content['en']);
          });
          y += 5;
      }

      // 6. Memberships
      if (faculty.membershipsList && faculty.membershipsList.length > 0) {
          addSectionHeader(language === 'vi' ? 'Thành viên Tổ chức Nghề nghiệp' : 'Current Membership in Professional Organizations');
          faculty.membershipsList.forEach(item => {
              addListItem(item.content[language] || item.content['en']);
          });
          y += 5;
      }

      // 7. Honors
      if (faculty.honorsList && faculty.honorsList.length > 0) {
          addSectionHeader(language === 'vi' ? 'Khen thưởng & Giải thưởng' : 'Honors and Awards');
          faculty.honorsList.forEach(item => {
              addListItem(item.content[language] || item.content['en']);
          });
          y += 5;
      }

      // 8. Service Activities
      if (faculty.serviceActivitiesList && faculty.serviceActivitiesList.length > 0) {
          addSectionHeader(language === 'vi' ? 'Hoạt động Phục vụ' : 'Service Activities');
          faculty.serviceActivitiesList.forEach(item => {
              addListItem(item.content[language] || item.content['en']);
          });
          y += 5;
      }

      // 9. Publications (Important to be near the end)
      if (faculty.publicationsList && faculty.publicationsList.length > 0) {
          addSectionHeader(language === 'vi' ? 'Công bố Khoa học & Thuyết trình' : 'Publications and Presentations');
          faculty.publicationsList.forEach((pub, i) => {
              const content = pub.text[language] || pub.text['en'];
              if (content) {
                  doc.setFontSize(10); 
                  doc.setFont('Roboto', 'normal');
                  // Numbered list for publications
                  const splitText = doc.splitTextToSize(`${i + 1}. ${content}`, 180);
                  checkPageBreak(splitText.length * 5 + 2);
                  doc.text(splitText, margin, y);
                  y += splitText.length * 5 + 2;
              }
          });
          y += 5;
      }

      // 10. Professional Development (Last section usually)
      if (faculty.professionalDevelopmentList && faculty.professionalDevelopmentList.length > 0) {
          addSectionHeader(language === 'vi' ? 'Hoạt động Phát triển Chuyên môn' : 'Professional Development Activities');
          faculty.professionalDevelopmentList.forEach(item => {
              addListItem(item.content[language] || item.content['en']);
          });
          y += 5;
      }

      // Save
      doc.save(`CV_${faculty.name[language].replace(/\s+/g, '_')}.pdf`);

  } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please check internet connection for font loading.");
  }
};
