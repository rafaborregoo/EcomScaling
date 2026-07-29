"use client";

import { Pagination as HeroPagination } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "./icons";

// Rango con elipsis: HeroUI Pagination es puramente presentacional (Link,
// Previous, Next, Ellipsis) y no calcula el rango de paginas, asi que se
// conserva la logica propia ya validada (ver packages/ui/src/components/pagination.tsx).
function paginationRange(page: number, pageCount: number): Array<number | "ellipsis"> {
  const delta = 1;
  const range: Array<number | "ellipsis"> = [];
  const start = Math.max(2, page - delta);
  const end = Math.min(pageCount - 1, page + delta);

  range.push(1);
  if (start > 2) {
    range.push("ellipsis");
  }
  for (let index = start; index <= end; index += 1) {
    range.push(index);
  }
  if (end < pageCount - 1) {
    range.push("ellipsis");
  }
  if (pageCount > 1) {
    range.push(pageCount);
  }

  return range;
}

export function Pagination({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) {
    return null;
  }

  return (
    <HeroPagination className={className} size="sm">
      <HeroPagination.Content>
        <HeroPagination.Item>
          <HeroPagination.Previous isDisabled={page <= 1} onPress={() => onChange(page - 1)}>
            <IconChevronLeft aria-hidden /> Anterior
          </HeroPagination.Previous>
        </HeroPagination.Item>
        {paginationRange(page, pageCount).map((item, index) =>
          item === "ellipsis" ? (
            <HeroPagination.Item key={`ellipsis-${index}`}>
              <HeroPagination.Ellipsis />
            </HeroPagination.Item>
          ) : (
            <HeroPagination.Item key={item}>
              <HeroPagination.Link isActive={item === page} onPress={() => onChange(item)}>
                {item}
              </HeroPagination.Link>
            </HeroPagination.Item>
          ),
        )}
        <HeroPagination.Item>
          <HeroPagination.Next isDisabled={page >= pageCount} onPress={() => onChange(page + 1)}>
            Siguiente <IconChevronRight aria-hidden />
          </HeroPagination.Next>
        </HeroPagination.Item>
      </HeroPagination.Content>
    </HeroPagination>
  );
}
