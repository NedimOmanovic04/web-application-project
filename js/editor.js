document.addEventListener('DOMContentLoaded', function () {
    let divEditor = document.getElementById("divEditor");
    let poruke = document.getElementById("poruke");
    let editor = null;

    try {
        editor = EditorTeksta(divEditor);
        console.log("Editor uspješno inicijalizovan!");
    } catch (error) {
        prikaziPorukuDugme("init", "Greška pri inicijalizaciji: " + error.message, "error");
        return;
    }

    // Funkcija za prikaz poruka
    function prikaziPorukuDugme(idDugmeta, tekst, tip, timeout = 0) {
        if (!poruke) return;

        const postojeca = poruke.querySelector(`.poruka[data-btn="${idDugmeta}"]`);
        if (postojeca) postojeca.remove();

        const svePoruke = poruke.querySelectorAll('.poruka');
        svePoruke.forEach(p => p.remove());

        const p = document.createElement('div');
        p.className = `poruka poruka-${tip}`;
        p.setAttribute('data-btn', idDugmeta);
        p.innerHTML = tekst;
        poruke.appendChild(p);

        if (timeout > 0) {
            setTimeout(() => {
                if (poruke.contains(p)) {
                    p.remove();
                }
            }, timeout);
        }
    }

    // Dugmad funkcionalnosti
    document.getElementById("btnBrojRijeci")?.addEventListener("click", function () {
        try {
            let rezultat = editor.dajBrojRijeci();
            prikaziPorukuDugme(
                'btnBrojRijeci',
                `Ukupno riječi: ${rezultat.ukupno}<br>` +
                `Boldirano: ${rezultat.boldiranih}<br>` +
                `Italic: ${rezultat.italic}`,
                "info"
            );
        } catch (error) {
            prikaziPorukuDugme('btnBrojRijeci', "Greška: " + error.message, "error");
        }
    });

    document.getElementById("btnUloge")?.addEventListener("click", function () {
        try {
            let uloge = editor.dajUloge();
            let tekst = uloge.length === 0
                ? "Nema pronađenih uloga u scenariju."
                : `Pronađene uloge (${uloge.length}):<br>` + uloge.map(u => `• ${u}`).join('<br>');
            prikaziPorukuDugme('btnUloge', tekst, "info");
        } catch (error) {
            prikaziPorukuDugme('btnUloge', "Greška: " + error.message, "error");
        }
    });

    document.getElementById("btnPogresnaUloga")?.addEventListener("click", function () {
        try {
            let pogresne = editor.pogresnaUloga();
            let tekst = pogresne.length === 0
                ? "Nema potencijalno pogrešno napisanih uloga."
                : `Potencijalno pogrešne uloge:<br>` + pogresne.map(u => `• ${u}`).join('<br>');
            prikaziPorukuDugme('btnPogresnaUloga', tekst, pogresne.length === 0 ? "success" : "warning");
        } catch (error) {
            prikaziPorukuDugme('btnPogresnaUloga', "Greška: " + error.message, "error");
        }
    });

    document.getElementById("btnBrojLinija")?.addEventListener("click", function () {
        let uloga = prompt("Unesite ime uloge:");
        if (!uloga) return;

        try {
            let brojLinija = editor.brojLinijaTeksta(uloga);
            prikaziPorukuDugme('btnBrojLinija', `Uloga "${uloga.toUpperCase()}" ima ${brojLinija} linija teksta.`, "info");
        } catch (error) {
            prikaziPorukuDugme('btnBrojLinija', "Greška: " + error.message, "error");
        }
    });

    document.getElementById("btnScenarijUloge")?.addEventListener("click", function () {
        let uloga = prompt("Unesite ime uloge:");
        if (!uloga) return;

        try {
            let scenarij = editor.scenarijUloge(uloga);
            if (scenarij.length === 0) {
                prikaziPorukuDugme('btnScenarijUloge', `Uloga "${uloga.toUpperCase()}" nije pronađena ili nema replika.`, "info");
            } else {
                let ispis = `Scenarij uloge "${uloga.toUpperCase()}" (${scenarij.length} replika):<br><br>`;
                scenarij.forEach((stavka, idx) => {
                    ispis += `<strong>Replika ${idx + 1}:</strong><br>`;
                    ispis += `Scena: ${stavka.scena}<br>`;
                    ispis += `Pozicija: ${stavka.pozicijaUTekstu}<br>`;
                    if (stavka.prethodni) {
                        ispis += `Prethodni: ${stavka.prethodni.uloga} - "${stavka.prethodni.linije.slice(0, 2).join(' ')}..."<br>`;
                    }
                    ispis += `Trenutni: ${stavka.trenutni.linije.slice(0, 2).join(' ')}...<br>`;
                    if (stavka.sljedeci) {
                        ispis += `Sljedeći: ${stavka.sljedeci.uloga} - "${stavka.sljedeci.linije.slice(0, 2).join(' ')}..."<br>`;
                    }
                    ispis += `<br>`;
                });
                prikaziPorukuDugme('btnScenarijUloge', ispis, "info");
            }
        } catch (error) {
            prikaziPorukuDugme('btnScenarijUloge', "Greška: " + error.message, "error");
        }
    });

    document.getElementById("btnGrupisiUloge")?.addEventListener("click", function () {
        try {
            let grupe = editor.grupisiUloge();
            if (grupe.length === 0) {
                prikaziPorukuDugme('btnGrupisiUloge', "Nema pronađenih grupa uloga.", "info");
            } else {
                let ispis = `Pronađeno ${grupe.length} dijalog-segmenata:<br><br>`;
                grupe.forEach((grupa, idx) => {
                    ispis += `<strong>Segment ${idx + 1}:</strong><br>`;
                    ispis += `Scena: ${grupa.scena}<br>`;
                    ispis += `Segment broj: ${grupa.segment}<br>`;
                    ispis += `Uloge: ${grupa.uloge.join(', ')}<br><br>`;
                });
                prikaziPorukuDugme('btnGrupisiUloge', ispis, "info");
            }
        } catch (error) {
            prikaziPorukuDugme('btnGrupisiUloge', "Greška: " + error.message, "error");
        }
    });

    // Format dugmad - poruka nestaje nakon 3 sekunde
    const formatDugmad = [
        { id: "btnBold", komanda: "bold", poruka: "Tekst je boldiran." },
        { id: "btnItalic", komanda: "italic", poruka: "Tekst je italic." },
        { id: "btnUnderline", komanda: "underline", poruka: "Tekst je podvučen." }
    ];

    formatDugmad.forEach(f => {
        document.getElementById(f.id)?.addEventListener("click", function () {
            try {
                let uspjeh = editor.formatirajTekst(f.komanda);
                if (uspjeh) {
                    prikaziPorukuDugme(f.id, f.poruka, "success", 3000); // automatsko brisanje poruke
                } else {
                    prikaziPorukuDugme(f.id, "Nije moguće formatirati - označite tekst prvo.", "warning", 3000);
                }
            } catch (error) {
                prikaziPorukuDugme(f.id, "Greška: " + error.message, "error", 3000);
            }
        });
    });
    // ========================================
    // SPIRALA 3 - API FUNKCIONALNOSTI
    // ========================================

    let trenutniScenarioId = null;
    let zakljucanaLinija = null; // {lineId, paragraf}
    let scenarioContent = []; // Čuva linije scenarija učitane sa servera

    function getUserId() {
        return parseInt(document.getElementById("inputUserId")?.value) || 1;
    }

    function getScenarioId() {
        return parseInt(document.getElementById("inputScenarioId")?.value) || 1;
    }

    function prikaziStatus(tekst, tip = "info") {
        const statusDiv = document.getElementById("statusZakljucavanja");
        if (statusDiv) {
            let boja = tip === "success" ? "#4caf50" :
                tip === "error" ? "#f44336" :
                    tip === "warning" ? "#ff9800" : "#2196f3";
            statusDiv.innerHTML = `<span style="color: ${boja};">${tekst}</span>`;
        }
    }

    // Učitavanje scenarija sa servera
    document.getElementById("btnUcitajScenarij")?.addEventListener("click", function () {
        let scenarioId = getScenarioId();
        prikaziStatus("Učitavam scenarij...", "info");

        PoziviAjaxFetch.getScenario(scenarioId, function (status, data) {
            if (status === 200) {
                trenutniScenarioId = data.id;
                scenarioContent = data.content;

                // Ažuriraj editor sa sadržajem scenarija
                let html = "";
                for (let line of data.content) {
                    html += `<p data-line-id="${line.lineId}" data-next-line-id="${line.nextLineId}">${line.text || "&nbsp;"}</p>`;
                }
                divEditor.innerHTML = html;

                // Dodaj event listenere na svaki paragraf
                dodajKlikNaParagrafe();

                prikaziStatus(`Učitan scenarij: "${data.title}" (ID: ${data.id})`, "success");
                prikaziPorukuDugme("btnUcitajScenarij", `Scenarij "${data.title}" uspješno učitan!`, "success", 3000);
            } else {
                prikaziStatus(`Greška: ${data.message}`, "error");
                prikaziPorukuDugme("btnUcitajScenarij", data.message || "Greška pri učitavanju!", "error");
            }
        });
    });

    // Kreiranje novog scenarija
    document.getElementById("btnNoviScenarij")?.addEventListener("click", function () {
        let naslov = prompt("Unesite naslov novog scenarija:", "Novi scenarij");
        if (naslov === null) return; // Korisnik je kliknuo Cancel

        prikaziStatus("Kreiram novi scenarij...", "info");

        PoziviAjaxFetch.postScenario(naslov, function (status, data) {
            if (status === 200) {
                trenutniScenarioId = data.id;
                scenarioContent = data.content;

                // Ažuriraj input polje sa ID-om
                document.getElementById("inputScenarioId").value = data.id;

                // Ažuriraj editor
                let html = "";
                for (let line of data.content) {
                    html += `<p data-line-id="${line.lineId}" data-next-line-id="${line.nextLineId}">${line.text || "&nbsp;"}</p>`;
                }
                divEditor.innerHTML = html;

                dodajKlikNaParagrafe();

                prikaziStatus(`Kreiran novi scenarij: "${data.title}" (ID: ${data.id})`, "success");
                prikaziPorukuDugme("btnNoviScenarij", `Scenarij "${data.title}" kreiran! ID: ${data.id}`, "success", 3000);
            } else {
                prikaziStatus(`Greška: ${data.message}`, "error");
                prikaziPorukuDugme("btnNoviScenarij", data.message || "Greška pri kreiranju!", "error");
            }
        });
    });

    // Dodaj click listenere na paragrafe za zaključavanje
    function dodajKlikNaParagrafe() {
        const paragrafi = divEditor.querySelectorAll("p[data-line-id]");
        paragrafi.forEach(p => {
            p.addEventListener("click", function (e) {
                e.stopPropagation();
                zakljucajLiniju(this);
            });
        });
    }

    // Zaključaj liniju
    function zakljucajLiniju(paragraf) {
        if (!trenutniScenarioId) {
            prikaziStatus("Prvo učitajte ili kreirajte scenarij!", "warning");
            return;
        }

        let lineId = parseInt(paragraf.getAttribute("data-line-id"));
        let userId = getUserId();

        // Ako je ista linija već zaključana, ne radi ništa
        if (zakljucanaLinija && zakljucanaLinija.lineId === lineId) {
            return;
        }

        // Ako postoji prethodno zaključana linija, PRVO je spasi
        if (zakljucanaLinija && zakljucanaLinija.paragraf) {
            let prethodniLineId = zakljucanaLinija.lineId;
            let prethodniTekst = zakljucanaLinija.paragraf.innerText.trim();

            // Spasi prethodnu liniju
            PoziviAjaxFetch.updateLine(trenutniScenarioId, prethodniLineId, userId, [prethodniTekst], function (status, data) {
                if (status === 200) {
                    // Ukloni highlight sa prethodne linije
                    zakljucanaLinija.paragraf.style.background = "";
                    zakljucanaLinija.paragraf.style.border = "";
                    console.log(`Linija ${prethodniLineId} automatski spašena.`);
                }
                // Nastavi sa zaključavanjem nove linije
                izvrsiZakljucavanje(paragraf, lineId, userId);
            });
        } else {
            // Nema prethodno zaključane linije, samo zaključaj novu
            izvrsiZakljucavanje(paragraf, lineId, userId);
        }
    }

    function izvrsiZakljucavanje(paragraf, lineId, userId) {
        prikaziStatus(`Zaključavam liniju ${lineId}...`, "info");

        PoziviAjaxFetch.lockLine(trenutniScenarioId, lineId, userId, function (status, data) {
            if (status === 200) {
                // Označi novu liniju
                paragraf.style.background = "rgba(76, 175, 80, 0.2)";
                paragraf.style.border = "1px solid #4caf50";

                zakljucanaLinija = { lineId, paragraf };
                prikaziStatus(`Linija ${lineId} zaključana. Možete uređivati.`, "success");
            } else if (status === 409) {
                prikaziStatus(`Linija ${lineId} je već zaključana od drugog korisnika!`, "error");
            } else {
                prikaziStatus(`Greška: ${data.message}`, "error");
            }
        });
    }

    // Spasi zaključanu liniju
    document.getElementById("btnSpasiLiniju")?.addEventListener("click", function () {
        if (!trenutniScenarioId) {
            prikaziStatus("Prvo učitajte ili kreirajte scenarij!", "warning");
            return;
        }

        if (!zakljucanaLinija) {
            prikaziStatus("Nema zaključane linije za spašavanje! Kliknite na liniju prvo.", "warning");
            return;
        }

        let userId = getUserId();
        let lineId = zakljucanaLinija.lineId;
        let noviTekst = zakljucanaLinija.paragraf.innerText.trim();

        prikaziStatus(`Spašavam liniju ${lineId}...`, "info");

        PoziviAjaxFetch.updateLine(trenutniScenarioId, lineId, userId, [noviTekst], function (status, data) {
            if (status === 200) {
                // Ukloni highlight
                zakljucanaLinija.paragraf.style.background = "";
                zakljucanaLinija.paragraf.style.border = "";
                zakljucanaLinija = null;

                prikaziStatus("Linija uspješno sačuvana i otključana!", "success");
                prikaziPorukuDugme("btnSpasiLiniju", "Linija sačuvana!", "success", 3000);
            } else {
                prikaziStatus(`Greška: ${data.message}`, "error");
                prikaziPorukuDugme("btnSpasiLiniju", data.message, "error");
            }
        });
    });

    document.getElementById("btnZakljucajLiniju")?.addEventListener("click", function () {
        if (!trenutniScenarioId) {
            prikaziStatus("Prvo učitajte ili kreirajte scenarij!", "warning");
            return;
        }

        let lineId = parseInt(document.getElementById("inputLineId")?.value) || 1;
        let userId = getUserId();

        prikaziStatus(`Zaključavam liniju ${lineId}...`, "info");

        PoziviAjaxFetch.lockLine(trenutniScenarioId, lineId, userId, function (status, data) {
            if (status === 200) {
                // Ukloni highlight sa prethodne linije
                if (zakljucanaLinija && zakljucanaLinija.paragraf) {
                    zakljucanaLinija.paragraf.style.background = "";
                    zakljucanaLinija.paragraf.style.border = "";
                }

                // Pronađi paragraf sa ovim lineId
                let paragraf = divEditor.querySelector(`p[data-line-id="${lineId}"]`);
                if (paragraf) {
                    paragraf.style.background = "rgba(76, 175, 80, 0.2)";
                    paragraf.style.border = "1px solid #4caf50";
                    zakljucanaLinija = { lineId, paragraf };
                }

                prikaziStatus(`✅ Linija ${lineId} zaključana! Možete uređivati.`, "success");
            } else if (status === 409) {
                prikaziStatus(`❌ Linija ${lineId} je već zaključana od drugog korisnika!`, "error");
            } else if (status === 404) {
                prikaziStatus(`❌ ${data.message}`, "error");
            } else {
                prikaziStatus(`❌ Greška: ${data.message}`, "error");
            }
        });
    });


    let zakljucaniLik = null;

    document.getElementById("btnZakljucajLika")?.addEventListener("click", function () {
        if (!trenutniScenarioId) {
            prikaziStatus("Prvo učitajte ili kreirajte scenarij!", "warning");
            return;
        }

        let characterName = document.getElementById("inputImeLika")?.value?.trim();
        if (!characterName) {
            prikaziStatus("Unesite ime lika u polje!", "warning");
            return;
        }

        let userId = getUserId();

        prikaziStatus(`Zaključavam lika "${characterName}"...`, "info");

        PoziviAjaxFetch.lockCharacter(trenutniScenarioId, characterName, userId, function (status, data) {
            if (status === 200) {
                zakljucaniLik = { characterName };
                prikaziStatus(`✅ Lik "${characterName}" zaključan! Sada možete promijeniti ime.`, "success");
            } else if (status === 409) {
                prikaziStatus(`❌ Lik "${characterName}" je već zaključan od drugog korisnika!`, "error");
            } else if (status === 404) {
                prikaziStatus(`❌ ${data.message}`, "error");
            } else {
                prikaziStatus(`❌ Greška: ${data.message}`, "error");
            }
        });
    });


    document.getElementById("btnPromijeniLika")?.addEventListener("click", function () {
        if (!trenutniScenarioId) {
            prikaziStatus("Prvo učitajte ili kreirajte scenarij!", "warning");
            return;
        }

        let staroIme = document.getElementById("inputImeLika")?.value?.trim();
        if (!staroIme) {
            prikaziStatus("Unesite staro ime lika u polje!", "warning");
            return;
        }

        let novoIme = prompt(`Unesite NOVO ime za lika "${staroIme}":`);
        if (!novoIme) return;

        let userId = getUserId();

        if (!zakljucaniLik || zakljucaniLik.characterName !== staroIme) {
            prikaziStatus(`Zaključavam lika "${staroIme}"...`, "info");

            PoziviAjaxFetch.lockCharacter(trenutniScenarioId, staroIme, userId, function (status, data) {
                if (status === 200 || (status === 200)) {
                    izvrsiPromjenuImena(staroIme, novoIme, userId);
                } else if (status === 409) {
                    prikaziStatus(`❌ Lik "${staroIme}" je već zaključan od drugog korisnika!`, "error");
                } else {
                    prikaziStatus(`❌ Greška: ${data.message}`, "error");
                }
            });
        } else {
            izvrsiPromjenuImena(staroIme, novoIme, userId);
        }
    });

    function izvrsiPromjenuImena(staroIme, novoIme, userId) {
        prikaziStatus(`Mijenjam ime iz "${staroIme}" u "${novoIme}"...`, "info");

        PoziviAjaxFetch.updateCharacter(trenutniScenarioId, userId, staroIme, novoIme, function (status, data) {
            if (status === 200) {
                zakljucaniLik = null;
                prikaziStatus(`✅ Ime lika uspješno promijenjeno: "${staroIme}" → "${novoIme}"`, "success");
                prikaziPorukuDugme("btnPromijeniLika", `"${staroIme}" → "${novoIme}"`, "success", 3000);

                // Refresh scenarij
                document.getElementById("btnUcitajScenarij")?.click();
            } else {
                prikaziStatus(`❌ Greška: ${data.message}`, "error");
            }
        });
    }

    // Spasi - Kreiraj Checkpoint
    document.querySelector(".btn-save")?.addEventListener("click", function () {
        if (!trenutniScenarioId) {
            prikaziStatus("Prvo učitajte ili kreirajte scenarij!", "warning");
            return;
        }

        let userId = getUserId();
        prikaziStatus("Kreiram checkpoint...", "info");

        PoziviAjaxFetch.createCheckpoint(trenutniScenarioId, userId, function (status, data) {
            if (status === 200) {
                prikaziStatus("✅ Checkpoint uspješno kreiran!", "success");
                prikaziPorukuDugme("btnSave", "Checkpoint sačuvan!", "success", 3000);
            } else {
                prikaziStatus(`❌ Greška: ${data.message}`, "error");
                prikaziPorukuDugme("btnSave", data.message, "error", 3000);
            }
        });
    });

    // Dodaj novu liniju
    document.getElementById("btnDodajLiniju")?.addEventListener("click", function () {
        if (!trenutniScenarioId) {
            prikaziStatus("Prvo učitajte ili kreirajte scenarij!", "warning");
            return;
        }

        let afterLineId = zakljucanaLinija ? zakljucanaLinija.lineId : null;

        prikaziStatus("Dodajem novu liniju...", "info");

        PoziviAjaxFetch.addLine(trenutniScenarioId, afterLineId, function (status, data) {
            if (status === 200) {
                prikaziStatus(`✅ Nova linija dodana (ID: ${data.lineId})! Osvježavam...`, "success");
                // Refresh scenarij
                document.getElementById("btnUcitajScenarij")?.click();
            } else {
                prikaziStatus(`❌ Greška: ${data.message}`, "error");
            }
        });
    });

    dodajKlikNaParagrafe();
});
