import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  descargarHtml,
  ErrorDescarga,
  esPrivada,
  MAX_BYTES,
  urlValida,
} from "../src/lib/importar/red.ts";
import { ErrorExtraccion, extraerOferta } from "../src/lib/importar/extrae.ts";

describe("esPrivada", () => {
  it("bloquea redes internas y metadatos de la nube", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fc00::1",
      "fd12::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "::ffff:a9fe:a9fe",
      "no-es-una-ip",
    ])
      assert.equal(esPrivada(ip), true, ip);
  });

  it("deja pasar IPs públicas", () => {
    for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111"])
      assert.equal(esPrivada(ip), false, ip);
  });
});

describe("urlValida", () => {
  it("rechaza esquemas, credenciales y puertos raros", () => {
    for (const u of [
      "file:///etc/passwd",
      "ftp://x.com",
      "javascript:alert(1)",
      "https://user:pw@x.com",
      "https://x.com:8080/",
      "no es url",
    ])
      assert.throws(() => urlValida(u), ErrorDescarga, u);
  });
  it("acepta http y https normales", () => {
    assert.equal(urlValida("https://x.com/a").hostname, "x.com");
    assert.equal(urlValida("http://x.com:80/a").hostname, "x.com");
  });
});

describe("descargarHtml", () => {
  let srv: http.Server;
  let base: string;
  beforeAll(async () => {
    srv = http.createServer((req, res) => {
      if (req.url === "/ok") {
        res.setHeader("content-type", "text/html");
        res.end("<html>hola</html>");
      } else if (req.url === "/redir") {
        res.writeHead(302, { location: "/ok" }).end();
      } else if (req.url === "/bucle") {
        res.writeHead(302, { location: "/bucle" }).end();
      } else if (req.url === "/interna") {
        res.writeHead(302, { location: "http://169.254.169.254/latest" }).end();
      } else if (req.url === "/grande") {
        res.setHeader("content-type", "text/html");
        res.end("x".repeat(MAX_BYTES + 10));
      } else if (req.url === "/json") {
        res.setHeader("content-type", "application/json");
        res.end("{}");
      } else res.writeHead(404).end();
    });
    await new Promise<void>((r) => srv.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  });
  afterAll(() => srv.close());

  const local = { permitirPrivadas: true };

  it("bloquea por defecto direcciones locales, por IP y por nombre", async () => {
    await assert.rejects(descargarHtml("http://127.0.0.1/"), ErrorDescarga);
    await assert.rejects(descargarHtml("http://[::1]/"), ErrorDescarga);
    await assert.rejects(descargarHtml("http://169.254.169.254/"), ErrorDescarga);
    await assert.rejects(
      descargarHtml("http://interno.ejemplo/", { resolver: async () => ["10.0.0.5"] }),
      /no está permitida/,
    );
  });

  it("bloquea si alguna de las direcciones del nombre es privada", async () => {
    await assert.rejects(
      descargarHtml("http://mixto.ejemplo/", { resolver: async () => ["8.8.8.8", "127.0.0.1"] }),
      ErrorDescarga,
    );
  });

  it("descarga y sigue redirecciones", async () => {
    assert.equal((await descargarHtml(`${base}/ok`, local)).html, "<html>hola</html>");
    const r = await descargarHtml(`${base}/redir`, local);
    assert.equal(r.url, `${base}/ok`);
  });

  it("limita el número de redirecciones", async () => {
    await assert.rejects(descargarHtml(`${base}/bucle`, local), /demasiadas veces/);
  });

  it("rechaza páginas enormes, no HTML y errores", async () => {
    await assert.rejects(descargarHtml(`${base}/grande`, local), ErrorDescarga);
    await assert.rejects(descargarHtml(`${base}/json`, local), /no es una página web/);
    await assert.rejects(descargarHtml(`${base}/nada`, local), /error \(404\)/);
  });
});

describe("extraerOferta", () => {
  const url = "https://empresa.com/empleo/1";
  const largo = "Buscamos una persona con experiencia en desarrollo web y ganas de aprender.";

  it("lee JobPosting en JSON-LD, también dentro de @graph", () => {
    const ld = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage" },
        {
          "@type": "JobPosting",
          title: "Desarrolladora &amp; líder",
          hiringOrganization: { name: "Acme" },
          jobLocation: { address: { addressLocality: "Madrid", addressCountry: "ES" } },
          baseSalary: { currency: "EUR", value: { minValue: 30000, maxValue: 40000 } },
          description: `<p>${largo}</p><style>x{}</style>`,
        },
      ],
    };
    const o = extraerOferta(
      `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
      url,
    );
    assert.equal(o.titulo, "Desarrolladora & líder");
    assert.equal(o.empresa, "Acme");
    assert.equal(o.ubicacion, "Madrid, ES");
    assert.equal(o.salario, "30000–40000 EUR");
    assert.equal(o.descripcion, largo);
    assert.equal(o.fuente, "enlace");
    assert.equal(o.url, url);
    assert.match(o.id, /^enlace:[0-9a-f]{16}$/);
  });

  it("marca Remoto con TELECOMMUTE", () => {
    const ld = {
      "@type": "JobPosting",
      title: "Dev",
      description: largo,
      jobLocationType: "TELECOMMUTE",
    };
    const o = extraerOferta(
      `<script type="application/ld+json">${JSON.stringify(ld)}</script>`,
      url,
    );
    assert.equal(o.ubicacion, "Remoto");
  });

  it("sin JSON-LD usa og:title y la descripción", () => {
    const o = extraerOferta(
      `<head><title>x</title><meta property="og:title" content="Backend Dev"><meta name="description" content="${largo}"></head>`,
      url,
    );
    assert.equal(o.titulo, "Backend Dev");
    assert.equal(o.descripcion, largo);
  });

  it("falla si no hay descripción suficiente", () => {
    assert.throws(() => extraerOferta("<title>Hola</title>", url), ErrorExtraccion);
    assert.throws(() => extraerOferta("<html></html>", url), ErrorExtraccion);
  });

  it("ignora JSON-LD roto", () => {
    const o = extraerOferta(
      `<script type="application/ld+json">{roto</script><title>Dev</title><meta name="description" content="${largo}">`,
      url,
    );
    assert.equal(o.titulo, "Dev");
  });
});
