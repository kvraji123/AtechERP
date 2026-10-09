import { AppError } from "./AppError.js";

export function getFinancialYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;

  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`;
  }

  return `${year - 1}-${String(year).slice(-2)}`;
}

export async function ensureDocumentSequence(connection, sequenceKey, financialYear, prefix, currentNumber = 0, numberPadding = 4) {
  await connection.execute(
    `
      INSERT INTO app_document_sequences
        (sequence_key, financial_year, prefix, current_number, number_padding)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE sequence_key = VALUES(sequence_key)
    `,
    [sequenceKey, financialYear, prefix, Number(currentNumber) || 0, numberPadding]
  );
}

export async function getNextDocumentNumber(
  connection,
  sequenceKey,
  financialYear = getFinancialYear()
) {
  const [rows] = await connection.execute(
    `
      SELECT
        prefix,
        current_number,
        number_padding
      FROM app_document_sequences
      WHERE sequence_key = ?
        AND financial_year = ?
      FOR UPDATE
    `,
    [sequenceKey, financialYear]
  );

  if (!rows.length) {
    throw new AppError(
      `Document sequence not configured for ${sequenceKey} / ${financialYear}.`,
      500
    );
  }

  const sequence = rows[0];
  const nextNumber = Number(sequence.current_number) + 1;

  await connection.execute(
    `
      UPDATE app_document_sequences
      SET current_number = ?
      WHERE sequence_key = ?
        AND financial_year = ?
    `,
    [nextNumber, sequenceKey, financialYear]
  );

  const paddedNumber = String(nextNumber).padStart(
    sequence.number_padding,
    "0"
  );

  if (sequenceKey === "ENQUIRY") {
    return [
      sequence.prefix,
      paddedNumber,
      String(financialYear).slice(2),
    ].join("/");
  }

  return [sequence.prefix, financialYear, paddedNumber].join("/");
}
