export type MenuPermission = {
  menuCode: string;
  menuName: string;
  route: string;
  icon: string;
  displayOrder: number;
  canView: boolean;
};

export type User = {
  empCode: string;
  empName: string;
  roleName: string;
  permissions?: string[];
  menus: MenuPermission[];
};
