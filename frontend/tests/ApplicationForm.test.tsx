import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { ApplicationForm } from "../src/components/ApplicationForm";
it("shows validation errors and does not send invalid financial records", async () => {
  const submit = vi.fn();
  render(<ApplicationForm onSubmit={submit} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Save application" }),
  );
  expect(
    await screen.findByText("Enter at least two characters"),
  ).toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
});
it("submits typed financial data after a valid applicant is entered", async () => {
  const submit = vi.fn();
  render(<ApplicationForm onSubmit={submit} />);
  await userEvent.type(
    screen.getByLabelText("Applicant name"),
    "Synthetic Person",
  );
  await userEvent.type(
    screen.getByLabelText("Applicant identifier"),
    "TEST-42",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Save application" }),
  );
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0]).toMatchObject({
    applicantName: "Synthetic Person",
    applicantId: "TEST-42",
    currency: "INR",
    monthlyIncome: 75000,
  });
});
