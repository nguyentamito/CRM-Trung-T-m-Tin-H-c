import { PaymentVoucher, CenterInfo } from '../types';
import { format } from 'date-fns';
import { formatNumber } from '../lib/utils';

export const printPaymentVoucher = (voucher: PaymentVoucher, centerInfo: CenterInfo) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <html>
      <head>
        <title>Phiếu Chi - ${voucher.voucherNumber}</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
          .center-info h1 { font-size: 18px; margin: 0; text-transform: uppercase; }
          .center-info p { font-size: 14px; margin: 5px 0; }
          .voucher-meta { text-align: right; font-size: 14px; }
          .title { text-align: center; margin-bottom: 30px; }
          .title h2 { font-size: 24px; margin: 0; text-transform: uppercase; }
          .title p { font-style: italic; margin: 5px 0; }
          .content { margin-bottom: 40px; line-height: 1.8; }
          .row { display: flex; margin-bottom: 10px; }
          .label { min-width: 180px; }
          .value { border-bottom: 1px dotted #999; flex: 1; font-weight: bold; }
          .signatures { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; margin-top: 50px; }
          .signature-box { height: 100px; }
          .footer { margin-top: 50px; font-size: 12px; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          @media print {
            body { padding: 20px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="center-info">
            <h1>${centerInfo.name}</h1>
            <p>Địa chỉ: ${centerInfo.address}</p>
            <p>Website: ${centerInfo.website}</p>
          </div>
          <div class="voucher-meta">
            <p>Mẫu số: 02 - 05/BLP</p>
            <p>Ký hiệu: PC/2026</p>
            <p>Số: <strong>${voucher.voucherNumber}</strong></p>
          </div>
        </div>

        <div class="title">
          <h2>PHIẾU CHI</h2>
          <p>Ngày ${format(voucher.createdAt, 'dd')} tháng ${format(voucher.createdAt, 'MM')} năm ${format(voucher.createdAt, 'yyyy')}</p>
        </div>

        <div class="content">
          <div class="row">
            <span class="label">Họ và tên người nhận:</span>
            <span class="value">${voucher.recipientName}</span>
          </div>
          <div class="row">
            <span class="label">Địa chỉ/Bộ phận:</span>
            <span class="value">${voucher.category}</span>
          </div>
          <div class="row">
            <span class="label">Lý do chi:</span>
            <span class="value">${voucher.description}</span>
          </div>
          <div class="row">
            <span class="label">Số tiền:</span>
            <span class="value">${formatNumber(voucher.amount)} VNĐ</span>
          </div>
          <div class="row">
            <span class="label">Bằng chữ:</span>
            <span class="value">..................................................................................................................................</span>
          </div>
          <div class="row">
            <span class="label">Kèm theo:</span>
            <span class="value">..................................................................................................................................</span>
          </div>
        </div>

        <div class="signatures">
          <div>
            <p><strong>Thủ trưởng đơn vị</strong></p>
            <p>(Ký, họ tên, đóng dấu)</p>
            <div class="signature-box"></div>
          </div>
          <div>
            <p><strong>Kế toán trưởng</strong></p>
            <p>(Ký, họ tên)</p>
            <div class="signature-box"></div>
          </div>
          <div>
            <p><strong>Người nhận tiền</strong></p>
            <p>(Ký, họ tên)</p>
            <div class="signature-box"></div>
          </div>
        </div>

        <div class="footer">
          <p>* Ghi chú: Phiếu chi được lập thành 02 liên. Một liên lưu tại quỹ, một liên giao cho người nhận tiền.</p>
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
