import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ListingCard, ListingImage } from "./App";

const listing = {
  id: "listing-1",
  title: "Велосипед",
  description: "Городской велосипед в хорошем состоянии",
  city: "Москва",
  condition: "GOOD",
  owner: { id: "user-1", name: "Алексей" },
  category: { name: "Спорт" },
  images: [{ url: "/uploads/bike.png" }]
};

describe("listing UI components", () => {
  it("renders an uploaded image with an accessible name and category badge", () => {
    render(<ListingImage url="/uploads/cat.png" title="Кот" badge="Хобби" />);
    const image = screen.getByRole("img", { name: "Кот" });
    expect(image).toHaveAttribute("src", "http://localhost:3000/uploads/cat.png");
    expect(image).toHaveAttribute("loading", "lazy");
    expect(screen.getByText("Хобби")).toBeInTheDocument();
  });

  it("renders a placeholder when a listing has no image", () => {
    const { container } = render(<ListingImage title="Книга" />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.querySelector(".card-image span")).toBeInTheDocument();
  });

  it("uses the detail image wrapper for a listing detail view", () => {
    const { container } = render(<ListingImage url="/uploads/book.png" title="Книга" variant="detail" />);
    expect(container.querySelector(".detail-image img")).toHaveAttribute("alt", "Книга");
    expect(container.querySelector(".detail-image")).toBeInTheDocument();
  });

  it("renders a listing card with title, author, city and category", () => {
    render(<MemoryRouter><ListingCard item={listing as any} /></MemoryRouter>);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/listing/listing-1");
    expect(screen.getByRole("heading", { name: "Велосипед" })).toBeInTheDocument();
    expect(screen.getByText(/Москва · Автор: Алексей/)).toBeInTheDocument();
    expect(screen.getByText("Спорт")).toBeInTheDocument();
    expect(screen.getByText("Городской велосипед в хорошем состоянии")).toBeInTheDocument();
  });
});
