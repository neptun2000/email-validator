{pkgs}: {
  deps = [
    pkgs.libxcrypt
    pkgs.openssl
    pkgs.bind
    pkgs.cacert
  ];
}
