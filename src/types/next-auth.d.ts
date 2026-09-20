import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string;
      username?: string;
      techId?: string;
      hospitalId?: string;
      organizationId?: string;
      organizationName?: string;
      organizationSlug?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    username?: string;
    techId?: string;
    hospitalId?: string;
    organizationId?: string;
    organizationName?: string;
    organizationSlug?: string;
  }
}
