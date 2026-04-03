
// ==============================================================================

import { COMPANY_ID_INFOCOMM, COMPANY_ID_NETWORK, COMPANY_ID_SOLUTION, COMPANY_ID_TECHNOSOFT } from './constant';

// Primary Colors
export const PRIMARY = '#8455f4';
export const PRIMARY_MEDIUM = '#47288F';
export const PRIMARY_LIGHT = '#E8F7FD';
export const SECONDARY = '#0b8546';
export const PRIMARY_DARK = '#087FAF';
// ==============================================================================
// Button Colors
export const BUTTON_PRIMARY = '#059CED';
export const BUTTON_DANGER = '#FF1717';
export const BUTTON_CANCEL = '#F5B0AE';
// ==============================================================================
// Background Colors
export const BACKGROUND_DEFAULT = '#F6F6F6';
export const BACKGROUND_SECONDARY = '#F3F2F8';
export const BACKGROUND_PINK = '#F2C7DD';
export const BACKGROUND_GREEN = '#E6FAEA';
export const TRANSPARENT = 'transparent';
// ==============================================================================
// Card Colors
export const CARD_DESCRIPTION = '#0089D1';
export const CARD_BORDER = '#F5DCB0';
// ==============================================================================
// Status Colors
export const SUCCESS = '#3ec21e';
export const WARNING = '#e5ac00';
export const ERROR = '#f6333f';
export const WAITING = '#FFE2B2';
export const DISABLED = '#BABABA';
// ==============================================================================
// Text Colors
export const TEXT_DARKER = '#222222';
export const TEXT_DARK = '#444444';
export const TEXT_MEDIUM = '#666666';
export const TEXT_LIGHT = '#AAAAAA';
export const TEXT_LIGHTER = '#CCCCCC';
export const TEXT_PLACEHOLDER = '#FFFFFFB3';
export const TEXT_DEVIDER = '#EEEEEE';
export const TEXT_LINK = '#0A28C1';
// ==============================================================================
// Border Colors
export const BORDER_DEFAULT = '#CFCFCF';
export const BORDER_SECONDARY = '#BABABA';
// ==============================================================================
// UI Element Colors
export const STATUS_BAR = '#4E468E';
export const LIST_HEADER = '#E7F0F5';
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';
export const BLACK_RGBA_65 = 'rgba(0,0,0,0.65)';
// ==============================================================================
// Accent Colors
export const ACCENT_PINK = '#FFC3C5';
export const ACCENT_PINK_LIGHT = '#F8EDEE';
export const ACCENT_ORANGE = '#D98B0D';
export const ACCENT_GREEN_LIGHT = '#34A85338';
// ==============================================================================
// ===================COMPANY COLORS ====================================
export const INFOCOMM = '#59b980';
export const NETWORK = '#e85d38';
export const TECHNOSOFT = '#47c1ef';
export const SOLUTION = '#785aa1';
export const colorDarkslategray = "#393d45";
export const colorDimgray100 = "#535353";
export const colorDimgray200 = "rgba(83, 83, 83, 0.7)";
export const colorGray = "rgba(255, 255, 255, 0.12)";
export const colorGray300 = "#00000066";
export const colorDeepskyblue = "#0ca2dd";
export const colorWhitesmoke100 = "#f3f6f9";
export const colorDimgray = "#6c6c6c";
export const colorWhite = "#fff";
export const colorGainsboro = "#e0e6e9";
export const colorDarkgray = "#979797";
export const colorGoldenrod100 = "#e5ac00";
export const colorMediumslateblue = "#155dfc";
export const colorWhitesmoke = "#eee";
export const colorSlategray = "#70747e";
export const colorDarkslategray300 = "#11354d";
export const colorDarkgoldenrod = "#ca961d";
export const colorDarkslategray100 = "#393d45";
export const colorDarkslategray200 = "rgba(55, 55, 55, 0.9)";
export const colorGainsboro100 = "#e0e6e9";
export const colorGainsboro200 = "rgba(222, 222, 222, 0.56)";
export const colorIndianred = "#ce6170";
export const colorPalegoldenrod = "#fbeaa6";
export const colorWhitesmoke200 = "#eee";
export const colorWhitesmoke300 = "rgba(238, 238, 238, 0.4)";
export const colorDarkorange = "#ea820b";
export const colorMediumaquamarine = "#15cea6";
export const colorLimegreen = "#3ec21e";
export const colorGold = "#ffc107";
export const colorCrimson = "#f6333f";
export const colorLightsteelblue = "#8eaacd";
export const colorLavender = "#e5e9fb";
export const colorSteelblue = "#007cad";
export const colorLightsteelblue100 = "#bec1d0";
export const colorLightsteelblue200 = "#8eaacd";
export const colorGoldenrod = "#e5ac00";
export const colorRed = "#ff0000";
export const colorForestgreen = "#007c00";
export const colorAliceblue = "#e2e8f0";
export const colorGoldenrod200 = "rgba(229, 172, 0, 0.08)";
export const colorSilver = "#c4c4c4";
export const colorGreen100 = "#1f9d00";
export const colorGreen200 = "#1F9D00";
export const colorGreen300 = "#1F9D000C";
export const colorGray200 = "#FFFFFF33";
export const colorGray100 = "#0000002B";
export const colorMediumslateblue100 = "#8858f9";
export const colorMediumslateblue200 = "#8858f9";
export const colorMediumslateblue300 = "#8858f9";
export const colorIndigo = "#47288f";
export const colorRed100 = "#FF1717";
export const colorRed200 = "#ff1717";
export const getCompanyColor = (id: number) => {
  return id === COMPANY_ID_NETWORK
    ? NETWORK
    : id === COMPANY_ID_SOLUTION
      ? SOLUTION
      : id === COMPANY_ID_TECHNOSOFT
        ? TECHNOSOFT
        : id === COMPANY_ID_INFOCOMM
          ? INFOCOMM
          : ACCENT_ORANGE;
};
export const COLORS = {
  PRIMARY,
  PRIMARY_MEDIUM,
  PRIMARY_LIGHT,
  SECONDARY,
  PRIMARY_DARK,

  BUTTON_PRIMARY,
  BUTTON_DANGER,
  BUTTON_CANCEL,

  BACKGROUND_DEFAULT,
  BACKGROUND_SECONDARY,
  BACKGROUND_PINK,
  BACKGROUND_GREEN,
  TRANSPARENT,

  CARD_DESCRIPTION,
  CARD_BORDER,

  SUCCESS,
  WARNING,
  ERROR,
  WAITING,
  DISABLED,

  TEXT_DARKER,
  TEXT_DARK,
  TEXT_MEDIUM,
  TEXT_LIGHT,
  TEXT_LIGHTER,
  TEXT_PLACEHOLDER,
  TEXT_DEVIDER,
  TEXT_LINK,

  BORDER_DEFAULT,
  BORDER_SECONDARY,

  STATUS_BAR,
  LIST_HEADER,
  WHITE,
  BLACK,
  BLACK_RGBA_65,

  ACCENT_PINK,
  ACCENT_PINK_LIGHT,
  ACCENT_ORANGE,
  ACCENT_GREEN_LIGHT,

  INFOCOMM,
  NETWORK,
  TECHNOSOFT,
  SOLUTION,

  colorDarkslategray,
  colorDimgray100,
  colorDimgray200,
  colorGray,
  colorGray300,
  colorDeepskyblue,
  colorWhitesmoke100,
  colorDimgray,
  colorWhite,
  colorGainsboro,
  colorDarkgray,
  colorGoldenrod100,
  colorMediumslateblue,
  colorWhitesmoke,
  colorSlategray,
  colorDarkslategray300,
  colorDarkgoldenrod,
  colorDarkslategray100,
  colorDarkslategray200,
  colorGainsboro100,
  colorGainsboro200,
  colorIndianred,
  colorPalegoldenrod,
  colorWhitesmoke200,
  colorWhitesmoke300,
  colorDarkorange,
  colorMediumaquamarine,
  colorLimegreen,
  colorGold,
  colorCrimson,
  colorLightsteelblue,
  colorLavender,
  colorSteelblue,
  colorLightsteelblue100,
  colorLightsteelblue200,
  colorGoldenrod,
  colorRed,
  colorForestgreen,
  colorAliceblue,
  colorGoldenrod200,
  colorSilver,
  colorGreen100,
  colorGreen200,
  colorGreen300,
  colorGray200,
  colorGray100,
  colorMediumslateblue100,
  colorMediumslateblue200,
  colorMediumslateblue300,
  colorIndigo,
  colorRed100,
  colorRed200,
};
