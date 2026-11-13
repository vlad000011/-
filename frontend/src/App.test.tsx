import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ListingImage } from "./App";

describe("ListingImage component", () => {
  it("renders an uploaded image inside the listing media component", () => {
    const { container } = render(
      <ListingImage url="/uploads/cat.png" title="Кот" badge="Хобби" />,
    );

    const image = screen.getByRole("img", { name: "Кот" });
    expect(image).toHaveAttribute("src", "http://localhost:3000/uploads/cat.png");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(container.querySelector(".card-image")).toBeInTheDocument();
    expect(screen.getByText("Хобби")).toBeInTheDocument();
  });

  it("renders a placeholder when an item has no uploaded image", () => {
    const { container } = render(<ListingImage title="Книга" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector(".card-image span")).toBeInTheDocument();
  });

  it("uses a bounded detail image container", () => {
    const { container } = render(
      <ListingImage url="/uploads/book.png" title="Книга" variant="detail" />,
    );

    expect(container.querySelector(".detail-image img")).toHaveAttribute("alt", "Книга");
    expect(container.querySelector(".detail-image")).toBeInTheDocument();
  });
});
