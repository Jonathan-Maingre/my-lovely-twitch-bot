function doPost(e) {
    try {
        if (!e.postData || !e.postData.contents) {
            return ContentService.createTextOutput("Aucune donnée reçue.");
        }
        let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("REFERRALMLP");
        let data = JSON.parse(e.postData.contents);

        let type = data.type.trim();

        switch (type) {
            case "writeFather":
                return writeFather(data.father, data.new_user);
            case "answer":
                return checkUser(data.answer, data.new_user);
            default:
                return ContentService.createTextOutput("Type de requête non reconnu.");
        }
    } catch (error) {
        return ContentService.createTextOutput("Error: " + error.message);
    }
}

function writeFather(father, new_user) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("REFERRALMLP");
    let date = new Date();
    // Vérifie si l'invité existe déjà
    let dataRange = sheet.getRange(2, 3, sheet.getLastRow(), 1).getValues();
    let alreadyExists = dataRange.some(function (row) {
        return row[0].toString().toLowerCase() === new_user.toLowerCase();
    });
    if (!alreadyExists) {
        sheet.appendRow([date, father, new_user]);
        updateTop10Fathers();
        return ContentService.createTextOutput("✅ Father recorded!");
    } else {
        return ContentService.createTextOutput("❌ You already have a father");
    }
}

// Vérifie la réponse et valide l'utilisateur si elle est correcte
function checkUser(answer, new_user) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("REFERRALMLP");
    const data = sheet.getDataRange().getValues();
    const sheetAnswer = data[1][6];

    if (!sheetAnswer){
        return ContentService.createTextOutput("❌ Answer system is closed !");
    }
    for (let i = 1; i < data.length; i++) {
        const user = data[i][2];
        if (
            user && user.toString().trim().toLowerCase() === new_user.trim().toLowerCase() &&
            sheetAnswer && sheetAnswer.toString().trim().toLowerCase() === answer.trim().toLowerCase()
        ) {
            if (data[i][3] === "X" || data[i][3] === "x") {
                return ContentService.createTextOutput("❌ User already validated !");
            }
            sheet.getRange(i + 1, 4).setValue("X"); // Colonne D
            updateTop10Fathers();
            return ContentService.createTextOutput("✅ User validated !");
        }
    }
    return ContentService.createTextOutput("❌ Wrong answer or user don't have a father");
}

function updateTop10Fathers() {
    SpreadsheetApp.flush();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName("REFERRALMLP");
    const topSheet = ss.getSheetByName("RANKING");

    if (!sourceSheet || !topSheet) {
        throw new Error("Les feuilles 'REFERRALMLP' ou 'RANKING' sont introuvables.");
    }
    const data = sourceSheet.getDataRange().getValues();
    const fatherCounts = {};
    for (let i = 1; i < data.length; i++) {
        // Colonne D = VALIDATE_USER, Colonne B = FATHER
        if ((data[i][3] === "X" || data[i][3] === "x") && data[i][1]) {
            const father = data[i][1];
            fatherCounts[father] = (fatherCounts[father] || 0) + 1;
        }
    }
    const sortedFathers = Object.entries(fatherCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    topSheet.getRange(8, 2).setValue("RANK");
    topSheet.getRange(8, 3).setValue("FATHER");
    topSheet.getRange(8, 4).setValue("TOTAL");
    sortedFathers.forEach(([name, count], index) => {
        topSheet.getRange(index + 9, 2).setValue(index + 1);
        topSheet.getRange(index + 9, 3).setValue(name);
        topSheet.getRange(index + 9, 4).setValue(count);
    });
}