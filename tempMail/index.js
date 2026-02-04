export const title_list = {
  veryifyEmail: "تاكيد البريد الالكتروني",
  resetPassword: "تعيين كلمة مرور جديدة",
};

export const BASE_TEMPLATE_MAIL = `
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>بريد عائلة مسعود</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --primary-color: #1a365d;
        --secondary-color: #2d3748;
        --accent-color: #38b2ac;
        --light-color: #f7fafc;
        --danger-color: #e53e3e;
        --success-color: #38a169;
        --border-radius: 12px;
        --box-shadow:
          0 10px 15px -3px rgba(0, 0, 0, 0.1),
          0 4px 6px -2px rgba(0, 0, 0, 0.05);
        --transition: all 0.3s ease;
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        font-family: "Cairo", sans-serif;
      }

      body {
        width: 100vw;
        min-height: 100vh;
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        color: var(--secondary-color);
        direction: rtl;
        overflow-x: hidden;
        padding: 20px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .root {
        width: 100%;
        max-width: 800px;
        min-height: 90vh;
        display: flex;
        flex-direction: column;
        background-color: white;
        border-radius: var(--border-radius);
        box-shadow: var(--box-shadow);
        overflow: hidden;
      }

      /* Header Styles */
      header {
        background: linear-gradient(
          90deg,
          var(--primary-color),
          var(--secondary-color)
        );
        color: white;
        padding: 30px 40px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      header::before {
        content: "";
        position: absolute;
        top: 0;
        right: 0;
        width: 100%;
        height: 100%;
        background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%231a365d' fill-opacity='0.1' fill-rule='evenodd'/%3E%3C/svg%3E");
        opacity: 0.2;
      }

      .logo-container {
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 20px;
      }

      .logo {
        width: 80px;
        height: 80px;
        background-color: white;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: var(--primary-color);
        font-size: 24px;
        font-weight: 700;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        margin-left: 15px;
      }

      h1 {
        font-size: 2.5rem;
        font-weight: 700;
        margin-bottom: 10px;
        text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.2);
      }

      .subtitle {
        font-size: 1.2rem;
        font-weight: 300;
        opacity: 0.9;
        max-width: 600px;
        margin: 0 auto;
        line-height: 1.6;
      }

      /* Main Content Styles */
      main {
        flex: 1;
        padding: 40px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .content {
        text-align: center;
        max-width: 600px;
        margin: 0 auto;
      }

      .icon-container {
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, var(--accent-color), #319795);
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 0 auto 30px;
        box-shadow: var(--box-shadow);
      }

      .icon-container i {
        font-size: 48px;
        color: white;
      }

      h2 {
        font-size: 2rem;
        color: var(--primary-color);
        margin-bottom: 15px;
        font-weight: 600;
      }

      .description {
        font-size: 1.1rem;
        line-height: 1.7;
        margin-bottom: 30px;
        color: var(--secondary-color);
      }

      .highlight {
        background-color: #e6fffa;
        padding: 15px;
        border-right: 4px solid var(--accent-color);
        border-radius: 8px;
        margin: 25px 0;
        text-align: right;
        font-size: 1.1rem;
      }

      .email-display {
        background-color: #f7fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 15px;
        margin: 20px 0;
        font-size: 1.2rem;
        font-weight: 600;
        color: var(--primary-color);
        display: inline-block;
        text-align: center;
      }

      /* Button Styles */
      .btn-container {
        margin: 30px 0;
      }

      .btn {
        display: inline-block;
        padding: 16px 40px;
        font-size: 1.2rem;
        font-weight: 600;
        text-decoration: none;
        border-radius: var(--border-radius);
        transition: var(--transition);
        cursor: pointer;
        border: none;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }

      .btn-primary {
        background: linear-gradient(90deg, var(--accent-color), #319795);
        color: white;
      }

      .btn-primary:hover {
        transform: translateY(-3px);
        box-shadow:
          0 10px 15px -3px rgba(0, 0, 0, 0.1),
          0 4px 6px -2px rgba(0, 0, 0, 0.05);
        background: linear-gradient(90deg, #319795, var(--accent-color));
      }

      .btn-secondary {
        background-color: white;
        color: var(--primary-color);
        border: 2px solid var(--accent-color);
        margin-right: 15px;
      }

      .btn-secondary:hover {
        background-color: #e6fffa;
      }

      /* Steps */
      .steps {
        display: flex;
        justify-content: space-between;
        margin: 40px 0;
        position: relative;
      }

      .steps::before {
        content: "";
        position: absolute;
        top: 20px;
        right: 0;
        width: 100%;
        height: 3px;
        background-color: #e2e8f0;
        z-index: 1;
      }

      .step {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        z-index: 2;
        flex: 1;
      }

      .step-number {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #e2e8f0;
        color: var(--secondary-color);
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 700;
        margin-bottom: 10px;
        transition: var(--transition);
      }

      .step.active .step-number {
        background-color: var(--accent-color);
        color: white;
        transform: scale(1.1);
      }

      .step-text {
        font-size: 0.9rem;
        text-align: center;
        color: var(--secondary-color);
        font-weight: 500;
      }

      /* Footer Styles */
      footer {
        background-color: #f7fafc;
        padding: 25px 40px;
        border-top: 1px solid #e2e8f0;
        text-align: center;
        color: #718096;
        font-size: 0.9rem;
      }

      .footer-links {
        display: flex;
        justify-content: center;
        margin-top: 15px;
        flex-wrap: wrap;
      }

      .footer-links a {
        color: var(--accent-color);
        text-decoration: none;
        margin: 0 10px;
        transition: var(--transition);
      }

      .footer-links a:hover {
        text-decoration: underline;
        color: var(--primary-color);
      }

      /* Responsive Design */
      @media (max-width: 768px) {
        .root {
          min-height: auto;
          margin: 20px 0;
        }

        header {
          padding: 25px 20px;
        }

        h1 {
          font-size: 2rem;
        }

        main {
          padding: 30px 20px;
        }

        .steps {
          flex-direction: column;
          gap: 25px;
        }

        .steps::before {
          display: none;
        }

        .btn {
          padding: 14px 30px;
          font-size: 1.1rem;
          display: block;
          width: 100%;
          margin-bottom: 15px;
        }

        .btn-secondary {
          margin-right: 0;
        }
      }

      /* Animation */
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .animated {
        animation: fadeIn 0.8s ease-out;
      }

      @keyframes pulse {
        0% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.05);
        }
        100% {
          transform: scale(1);
        }
      }

      .pulse {
        animation: pulse 2s infinite;
      }

      .btn-link {
        text-decoration: none;
        padding: 10px 30px;
        border-radius: 10px;
        color: #fff;
        background: linear-gradient(
          90deg,
          var(--primary-color),
          var(--secondary-color)
        );
      }
    </style>
  </head>
  <body>
    <div class="root animated">
      <header>
        <div class="logo-container">
          <div class="logo">م</div>
          <div>
            <h1>بريد عائلة مسعود</h1>
            <p class="subtitle">خدمة البريد الإلكتروني لعائلة مسعود - TITLE</p>
          </div>
        </div>
      </header>

      <main>
        <div class="content">
          <div class="icon-container pulse">
            <span style="font-size: 48px">✉️</span>
          </div>

          <!-- CONTENT -->
          CONTENT
          <!-- END CONTENT -->

          <p style="margin-top: 20px; color: #718096; font-size: 0.9rem">
            إذا لم تطلب هذا البريد، يمكنك تجاهله بأمان. لمزيد من المساعدة، يرجى
            الاتصال بـ
            <a
              href="#"
              style="color: var(--accent-color); text-decoration: none"
              >دعم عائلة مسعود</a
            >
          </p>
        </div>
      </main>

      <footer>
        <p>© 2026 بريد عائلة مسعود. جميع الحقوق محفوظة.</p>
        <div class="footer-links">
          <a href="#">سياسة الخصوصية</a>
          <a href="#">شروط الاستخدام</a>
          <a href="#">الدعم الفني</a>
          <a href="#">اتصل بنا</a>
        </div>
      </footer>
    </div>
  </body>
</html>
`;

export const VERIFY_MAIL = `
<h2>تأكيد البريد الإلكتروني</h2>

<p class="description">
  شكراً لتسجيلك في بريد عائلة مسعود. لتفعيل حسابك، يرجى النقر على زر التأكيد
  أدناه. هذا يساعدنا على التحقق من عنوان بريدك الإلكتروني وضمان أمان حسابك.
</p>

<div class="highlight">
  <strong>ملاحظة:</strong> الرابط الموجود في هذا البريد الإلكتروني صالح لمدة
  دقيقتين فقط. إذا انتهت صلاحية الرابط، يمكنك طلب رابط تأكيد جديد من خلال صفحة
  الإعدادات.
</div>

<div style="text-align: center">
  <a href="URL" class="btn-link">تأكيد البريد الإلكتروني</a>
</div>
`;

export const VERIFY_CODE = `
<h2>تأكيد البريد الإلكتروني</h2>

<p class="description">
  شكراً لتسجيلك في بريد عائلة مسعود. لتفعيل حسابك، يرجى النقر على زر التأكيد
  أدناه. هذا يساعدنا على التحقق من عنوان بريدك الإلكتروني وضمان أمان حسابك.
</p>

<div class="highlight">
  <strong>ملاحظة:</strong> الرابط الموجود في هذا البريد الإلكتروني صالح لمدة
  دقيقتين فقط. إذا انتهت صلاحية الرابط، يمكنك طلب رابط تأكيد جديد من خلال صفحة
  الإعدادات.
</div>

<p class="description">رمز التحقق: CODE</p>
`;

export const RESET_PASSWORD = `
<h2>تعيين كلمة مرور جديدة</h2>

<p class="description">
  لقد تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. لإكمال العملية
  وإنشاء كلمة مرور جديدة، يرجى النقر على زر التأكيد أدناه. إذا لم تقم بطلب إعادة
  تعيين كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.
</p>

<div class="highlight">
  <strong>ملاحظة:</strong> الرابط الموجود في هذا البريد الإلكتروني صالح لمدة
  دقيقتين فقط. إذا انتهت صلاحية الرابط، يمكنك طلب رابط تأكيد جديد من خلال صفحة
  الإعدادات.
</div>

<div style="text-align: center">
  <a href="URL" class="btn-link">تعيين كلمة مرور جديدة</a>
</div>
`;
