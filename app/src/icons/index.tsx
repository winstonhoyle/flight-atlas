import { Icon, type IconProps } from "./Icon";

// Material icons (Apache-2.0), the set USWDS draws from.
const PATHS = {
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  arrowBack: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  close:
    "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  expandLess: "m12 8-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z",
  expandMore: "M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z",
  info: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  openInNew:
    "M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z",
  remove: "M19 13H5v-2h14v2z",
  settings:
    "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
};

export const AddIcon = (props: IconProps) => <Icon path={PATHS.add} {...props} />;
export const ArrowBackIcon = (props: IconProps) => <Icon path={PATHS.arrowBack} {...props} />;
export const CloseIcon = (props: IconProps) => <Icon path={PATHS.close} {...props} />;
export const ExpandLessIcon = (props: IconProps) => <Icon path={PATHS.expandLess} {...props} />;
export const ExpandMoreIcon = (props: IconProps) => <Icon path={PATHS.expandMore} {...props} />;
export const InfoIcon = (props: IconProps) => <Icon path={PATHS.info} {...props} />;
export const OpenInNewIcon = (props: IconProps) => <Icon path={PATHS.openInNew} {...props} />;
export const RemoveIcon = (props: IconProps) => <Icon path={PATHS.remove} {...props} />;
export const SettingsIcon = (props: IconProps) => <Icon path={PATHS.settings} {...props} />;
