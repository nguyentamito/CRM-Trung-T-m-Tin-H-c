import { Receipt, CenterInfo } from '../types';
import { formatNumber, numberToVietnameseWords } from '../lib/utils';

export const printReceipt = (receipt: Receipt, centerInfo: CenterInfo) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const date = new Date(receipt.createdAt);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  const html = `
    <html>
      <head>
        <title>In Biên Lai - ${receipt.id}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { 
            font-family: "Times New Roman", Times, serif; 
            line-height: 1.5; 
            color: #000;
            margin: 0;
            padding: 20px;
          }
          .warning {
            text-align: center;
            font-size: 11px;
            font-style: italic;
            margin-bottom: 20px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .company-info h1 {
            font-size: 18px;
            margin: 0;
            text-transform: uppercase;
          }
          .company-info p {
            font-size: 13px;
            margin: 2px 0;
          }
          .receipt-meta {
            text-align: right;
            font-size: 13px;
          }
          .receipt-meta p { margin: 2px 0; }
          
          .title-section {
            text-align: center;
            margin-bottom: 40px;
          }
          .title-section h2 {
            font-size: 24px;
            margin: 0;
            letter-spacing: 2px;
          }
          .title-section p {
            font-size: 14px;
            margin: 5px 0;
          }

          .content-section {
            margin-bottom: 40px;
          }
          .row {
            display: flex;
            margin-bottom: 15px;
            align-items: baseline;
          }
          .label {
            font-size: 15px;
            white-space: nowrap;
            margin-right: 10px;
          }
          .value {
            flex: 1;
            border-bottom: 1px dotted #000;
            font-size: 15px;
            padding-left: 5px;
            min-height: 22px;
          }
          .value.bold { font-weight: bold; }

          .footer-section {
            display: flex;
            justify-content: flex-end;
            margin-top: 50px;
          }
          .signature-box {
            text-align: center;
            width: 250px;
          }
          .signature-box .date {
            font-style: italic;
            margin-bottom: 10px;
          }
          .signature-box .role {
            font-weight: bold;
            margin-bottom: 60px;
          }
          .signature-box .note {
            font-size: 12px;
            font-style: italic;
          }

          .bottom-note {
            margin-top: 100px;
            font-size: 12px;
            line-height: 1.4;
          }
          
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h1>${centerInfo.name}</h1>
            <p>Địa chỉ: ${centerInfo.address}</p>
            <p>Website: ${centerInfo.website}</p>
          </div>
          <div class="receipt-meta">
            <p>Mẫu số: 01 - 05/BLP</p>
            <p>Ký hiệu: AA/2012P</p>
            <p>Số: <strong>${receipt.receiptNumber || receipt.id.slice(-6).toUpperCase()}</strong></p>
          </div>
        </div>

        <div class="title-section">
          <h2>BIÊN LAI THU HỌC PHÍ</h2>
          <p>Liên 1: Lưu</p>
        </div>

        <div class="content-section">
          <div class="row">
            <span class="label">Họ tên người nộp tiền:</span>
            <span class="value bold">${receipt.customerName}</span>
          </div>
          <div class="row">
            <span class="label">Địa chỉ:</span>
            <span class="value"></span>
          </div>
          <div class="row">
            <span class="label">Lý do thu:</span>
            <span class="value">Thu học phí môn ${receipt.subject || 'N/A'} (${receipt.type}) ${receipt.note ? '- ' + receipt.note : ''}</span>
          </div>
          <div class="row">
            <span class="label">Số tiền:</span>
            <span class="value bold">${formatNumber(receipt.amount)} VNĐ</span>
          </div>
          <div class="row">
            <span class="label">Bằng chữ:</span>
            <span class="value italic">${numberToVietnameseWords(receipt.amount)}</span>
          </div>
          <div class="row">
            <span class="label">Hình thức thanh toán:</span>
            <span class="value capitalize">${receipt.paymentMethod}</span>
          </div>
        </div>

        <div class="footer-section">
          <div class="signature-box">
            <div class="date">Ngày ${day} tháng ${month} năm ${year}</div>
            <div class="role">Người thu tiền</div>
            <div style="margin-top: 80px; font-weight: bold;">${receipt.staffName}</div>
          </div>
        </div>

        <div class="bottom-note">
          <p>* Ghi chú: Đề nghị Học viên giữ biên lai cẩn thận và xuất trình khi trung tâm yêu cầu.</p>
        </div>

        <script>
          window.onload = () => {
            window.print();
            // window.close();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};
