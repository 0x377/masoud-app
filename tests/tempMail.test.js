import {
  TITLE_LIST,
  BASE_TEMPLATE_MAIL,
  VERIFY_CODE,
  VERIFY_MAIL,
  RESET_PASSWORD,
  SUCCESS_RESET_PASSWORD,
} from "../tempMail/index.js";

const verifyCode = BASE_TEMPLATE_MAIL.replace("TITLE", TITLE_LIST.verifyCode)
  .replace("CONTENT", VERIFY_CODE)
  .replace("CODE", "123456");

console.log(verifyCode);
