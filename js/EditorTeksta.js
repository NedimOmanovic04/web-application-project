let EditorTeksta = function (divRef) {
    if (!divRef || divRef.tagName !== 'DIV') {
        throw new Error("Pogresan tip elementa!");
    }
    if (!divRef.hasAttribute('contenteditable') || divRef.getAttribute('contenteditable') !== 'true') {
        throw new Error("Neispravan DIV, ne posjeduje contenteditable atribut!");
    }

    let editor = divRef;

    function dajTekst() {
        return editor.innerText || '';
    }

    function dajHTML() {
        return editor.innerHTML || '';
    }

    function jeLiRijec(str) {
        return /[a-zA-ZčćžšđČĆŽŠĐ]/.test(str);
    }

    function ekstrakcijaBrojRijeci(element) {
        let ukupno = 0;
        let boldiranih = 0;
        let italic = 0;

        function obradiNode(node, jeBold, jeItalic) {
            if (node.nodeType === Node.TEXT_NODE) {
                let tekst = node.textContent;
                let rijeci = tekst.split(/[\s,.]+/).filter(w => jeLiRijec(w));
                ukupno += rijeci.length;
                if (jeBold) boldiranih += rijeci.length;
                if (jeItalic) italic += rijeci.length;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                let tagName = node.tagName.toLowerCase();
                let noviBold = jeBold || tagName === 'b' || tagName === 'strong';
                let noviItalic = jeItalic || tagName === 'i' || tagName === 'em';

                for (let child of node.childNodes) {
                    obradiNode(child, noviBold, noviItalic);
                }
            }
        }

        obradiNode(element, false, false);
        return { ukupno, boldiranih, italic };
    }

    function dajLinije() {
        // Uzmi ceo tekst i podeli po <br> ili novim linijama
        let html = editor.innerHTML;
        
        // Prvo pokusaj sa <p> elementima
        let pElements = editor.querySelectorAll("p");
        if (pElements.length > 0) {
            return [...pElements].map(e => e.innerText.trim());
        }
        
        // Ako nema <p>, podeli po <br>
        let linije = html.split(/<br\s*\/?>/i)
            .map(line => {
                // Ocisti HTML tagove i uzmi samo tekst
                let temp = document.createElement('div');
                temp.innerHTML = line;
                return (temp.textContent || temp.innerText || '').trim();
            })
            .filter(line => line !== ''); // Ukloni potpuno prazne linije
        
        return linije;
    }

    function jeUloga(linija, sljedecaLinija) {
        if (!linija || !sljedecaLinija) return false;
        linija = linija.trim();
        if (!linija || !/^[A-ZČĆŽŠĐ\s]+$/.test(linija)) return false;
        if (!/[A-ZČĆŽŠĐ]/.test(linija)) return false;
        
        sljedecaLinija = sljedecaLinija.trim();
        if (!sljedecaLinija) return false;
        if (/^[A-ZČĆŽŠĐ\s]+$/.test(sljedecaLinija) && /[A-ZČĆŽŠĐ]/.test(sljedecaLinija)) return false;
        if (jeNaslovScene(sljedecaLinija)) return false;
        
        // Ako je sljedeća linija u zagradama, to NIJE dovoljan govor
        // Mora postojati barem jedna linija koja NIJE u zagradama
        return true;
    }

    function jeNaslovScene(linija) {
        linija = linija.trim();
        if (!/^(INT\.|EXT\.)/.test(linija)) return false;
        if (!linija.includes('-')) return false;
        let poslije = linija.split('-').slice(1).join('-').trim();
        let rijeci = poslije.split(/\s+/);
        let vremena = ['DAY', 'NIGHT', 'AFTERNOON', 'MORNING', 'EVENING'];
        return vremena.includes(rijeci[0]);
    }

    function jeLinijaUZagradama(linija) {
        linija = linija.trim();
        return linija.startsWith('(') && linija.endsWith(')');
    }

    function levenshteinDistance(a, b) {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        return matrix[b.length][a.length];
    }

    function suVrloSlicne(ime1, ime2) {
        let dist = levenshteinDistance(ime1, ime2);
        let maxDuljina = Math.max(ime1.length, ime2.length);
        if (maxDuljina <= 5) return dist === 1;
        return dist <= 2;
    }

    let dajBrojRijeci = function () {
        return ekstrakcijaBrojRijeci(editor);
    };

    let dajUloge = function () {
        let linije = dajLinije();
        let uloge = [];
        let vidjeneUloge = new Set();

        for (let i = 0; i < linije.length - 1; i++) {
            let linija = linije[i].trim();
            
            // Provjeri da li je ovo potencijalna uloga
            if (!/^[A-ZČĆŽŠĐ\s]+$/.test(linija) || !/[A-ZČĆŽŠĐ]/.test(linija)) continue;
            
            // Provjeri da li ispod postoji PRAVI govor (ne samo zagrade)
            let imaGovor = false;
            for (let j = i + 1; j < linije.length; j++) {
                let govLinija = linije[j].trim();
                
                if (!govLinija) break; // Prazna linija prekida
                if (jeNaslovScene(govLinija)) break; // Nova scena prekida
                if (/^[A-ZČĆŽŠĐ\s]+$/.test(govLinija) && /[A-ZČĆŽŠĐ]/.test(govLinija)) break; // Nova uloga prekida
                
                // Ako linija nije u zagradama, to je pravi govor
                if (!jeLinijaUZagradama(govLinija)) {
                    imaGovor = true;
                    break;
                }
            }
            
            if (imaGovor && !vidjeneUloge.has(linija)) {
                uloge.push(linija);
                vidjeneUloge.add(linija);
            }
        }

        return uloge;
    };

    function pogresnaUloga() {
        let linije = dajLinije();
        let uloge = [];

        // Pronađi sve uloge
        for (let i = 0; i < linije.length - 1; i++) {
            if (jeUloga(linije[i], linije[i + 1])) {
                uloge.push(linije[i].trim());
            }
        }

        // Brojanje pojavljivanja
        let mapaBrojanja = {};
        for (let u of uloge) {
            mapaBrojanja[u] = (mapaBrojanja[u] || 0) + 1;
        }

        let rezultat = new Set();
        let sveUloge = Object.keys(mapaBrojanja);

        for (let A of sveUloge) {
            for (let B of sveUloge) {
                if (A === B) continue;

                if (suVrloSlicne(A, B)) {
                    let brojA = mapaBrojanja[A];
                    let brojB = mapaBrojanja[B];

                    // B je česta, A je retka
                    if (brojB >= 4 && brojB >= brojA + 3) {
                        rezultat.add(A);
                    }
                }
            }
        }

        return [...rezultat];
    }

    let brojLinijaTeksta = function (uloga) {
        uloga = uloga.toUpperCase();
        let linije = dajLinije();
        let brojLinija = 0;

        for (let i = 0; i < linije.length - 1; i++) {
            if (jeUloga(linije[i], linije[i + 1]) && linije[i].trim() === uloga) {
                let j = i + 1;
                while (j < linije.length) {
                    let trenutnaLinija = linije[j].trim();
                    
                    if (!trenutnaLinija) break;
                    if (jeNaslovScene(trenutnaLinija)) break;
                    if (jeUloga(linije[j], linije[j + 1] || '')) break;
                    
                    if (!jeLinijaUZagradama(trenutnaLinija)) {
                        brojLinija++;
                    }
                    j++;
                }
            }
        }

        return brojLinija;
    };

    let scenarijUloge = function (uloga) {
        uloga = uloga.toUpperCase();
        let linije = dajLinije();
        let sveReplike = []; // SVE replike u cijelom scenariju
        let trenutnaScena = '';

        // KORAK 1: Parsiraj SVE replike (svih uloga)
        for (let i = 0; i < linije.length; i++) {
            let linija = linije[i].trim();

            if (jeNaslovScene(linija)) {
                trenutnaScena = linija;
                continue;
            }

            // Provjeri da li je ovo uloga
            if (!/^[A-ZČĆŽŠĐ\s]+$/.test(linija) || !/[A-ZČĆŽŠĐ]/.test(linija)) continue;
            
            let imeUloge = linija;
            let linijeGovora = [];
            let j = i + 1;

            while (j < linije.length) {
                let govLinija = linije[j].trim();
                
                if (!govLinija) {
                    if (linijeGovora.length > 0) break;
                    j++;
                    continue;
                }
                if (jeNaslovScene(govLinija)) break;
                if (/^[A-ZČĆŽŠĐ\s]+$/.test(govLinija) && /[A-ZČĆŽŠĐ]/.test(govLinija)) break;
                
                if (!jeLinijaUZagradama(govLinija)) {
                    linijeGovora.push(govLinija);
                }
                j++;
            }

            if (linijeGovora.length > 0) {
                sveReplike.push({
                    scena: trenutnaScena,
                    uloga: imeUloge,
                    linije: linijeGovora
                });
            }
            i = j - 1;
        }

        // KORAK 2: Grupiši replike po scenama i dodaj pozicije
        let replikePoScenama = {};
        sveReplike.forEach(r => {
            if (!replikePoScenama[r.scena]) {
                replikePoScenama[r.scena] = [];
            }
            replikePoScenama[r.scena].push(r);
        });

        // KORAK 3: Kreiraj rezultat samo za traženu ulogu
        let rezultat = [];
        
        sveReplike.forEach((replika, globalIdx) => {
            if (replika.uloga !== uloga) return;

            let replikeUSceni = replikePoScenama[replika.scena];
            let indeksUSceni = replikeUSceni.indexOf(replika);
            
            let prethodni = null;
            if (indeksUSceni > 0) {
                let preth = replikeUSceni[indeksUSceni - 1];
                prethodni = {
                    uloga: preth.uloga,
                    linije: preth.linije
                };
            }

            let sljedeci = null;
            if (indeksUSceni < replikeUSceni.length - 1) {
                let slj = replikeUSceni[indeksUSceni + 1];
                sljedeci = {
                    uloga: slj.uloga,
                    linije: slj.linije
                };
            }

            rezultat.push({
                scena: replika.scena,
                pozicijaUTekstu: indeksUSceni + 1,
                prethodni: prethodni,
                trenutni: {
                    uloga: replika.uloga,
                    linije: replika.linije
                },
                sljedeci: sljedeci
            });
        });

        return rezultat;
    };

    let grupisiUloge = function () {
        let linije = dajLinije();
        let rezultat = [];
        let trenutnaScena = '';
        let segmentBroj = 0;
        let ulogeUSegmentu = [];
        let poredakUloga = [];
        let imaReplika = false;

        function zavrsiSegment() {
            if (imaReplika && ulogeUSegmentu.length > 0) {
                rezultat.push({
                    scena: trenutnaScena,
                    segment: segmentBroj,
                    uloge: poredakUloga
                });
            }
        }

        for (let i = 0; i < linije.length; i++) {
            let linija = linije[i].trim();

            if (jeNaslovScene(linija)) {
                zavrsiSegment();
                trenutnaScena = linija;
                segmentBroj = 0;
                ulogeUSegmentu = [];
                poredakUloga = [];
                imaReplika = false;
                continue;
            }

            // Provjeri da li je ovo potencijalna uloga (sva velika slova)
            let izgleda_kao_uloga = /^[A-ZČĆŽŠĐ\s]+$/.test(linija) && /[A-ZČĆŽŠĐ]/.test(linija);
            
            if (izgleda_kao_uloga && i < linije.length - 1) {
                let imeUloge = linija;
                let imaValidanGovor = false;
                let j = i + 1;

                // Provjeri da li nakon ove linije slijedi govor
                while (j < linije.length) {
                    let govLinija = linije[j].trim();
                    
                    if (!govLinija) {
                        if (imaValidanGovor) break;
                        j++;
                        continue;
                    }
                    if (jeNaslovScene(govLinija)) break;
                    
                    // Ako je sljedeća linija također velika slova, prekini
                    if (/^[A-ZČĆŽŠĐ\s]+$/.test(govLinija) && /[A-ZČĆŽŠĐ]/.test(govLinija)) break;
                    
                    if (!jeLinijaUZagradama(govLinija)) {
                        imaValidanGovor = true;
                    }
                    j++;
                }

                // Ako IMA validnog govora, ovo je prava uloga
                if (imaValidanGovor) {
                    if (!imaReplika) {
                        segmentBroj++;
                        ulogeUSegmentu = [];
                        poredakUloga = [];
                        imaReplika = true;
                    }

                    if (!ulogeUSegmentu.includes(imeUloge)) {
                        ulogeUSegmentu.push(imeUloge);
                        poredakUloga.push(imeUloge);
                    }
                    
                    i = j - 1;
                } else {
                    // Nema validnog govora - ovo je AKCIJA ili opis, prekida segment
                    zavrsiSegment();
                    ulogeUSegmentu = [];
                    poredakUloga = [];
                    imaReplika = false;
                }
            } else if (linija && !jeLinijaUZagradama(linija) && !jeNaslovScene(linija) && !izgleda_kao_uloga) {
                // Obična linija teksta koja nije uloga - takođe prekida segment
                zavrsiSegment();
                ulogeUSegmentu = [];
                poredakUloga = [];
                imaReplika = false;
            }
        }

        zavrsiSegment();
        return rezultat;
    };

    let formatirajTekst = function (komanda) {
        let sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return false;
        if (sel.isCollapsed) return false;

        let range = sel.getRangeAt(0);
        if (!editor.contains(range.commonAncestorContainer)) return false;

        let tagMap = {
            'bold': 'b',
            'italic': 'i',
            'underline': 'u'
        };

        let tag = tagMap[komanda];
        if (!tag) return false;

        document.execCommand(komanda, false, null);
        return true;
    };

    return {
        dajBrojRijeci: dajBrojRijeci,
        dajUloge: dajUloge,
        pogresnaUloga: pogresnaUloga,
        brojLinijaTeksta: brojLinijaTeksta,
        scenarijUloge: scenarijUloge,
        grupisiUloge: grupisiUloge,
        formatirajTekst: formatirajTekst
    };
};