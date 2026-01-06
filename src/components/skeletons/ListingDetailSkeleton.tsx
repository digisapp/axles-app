'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function ListingDetailSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6">
        {/* Back Link */}
        <Skeleton className="h-6 w-24 mb-4 md:mb-6" />

        <div className="grid lg:grid-cols-3 gap-4 md:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* Main Image */}
            <Skeleton className="aspect-[16/10] rounded-lg md:rounded-xl" />

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-4 gap-1 md:gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] rounded md:rounded-lg" />
              ))}
            </div>

            {/* Title & Price */}
            <div className="space-y-2">
              <Skeleton className="h-8 md:h-10 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-14" />
              </div>
              <Skeleton className="h-8 md:h-10 w-32" />
            </div>

            {/* Details Card */}
            <Card>
              <CardHeader className="pb-2 md:pb-4">
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-24" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Description Card */}
            <Card>
              <CardHeader className="pb-2 md:pb-4">
                <Skeleton className="h-6 w-28" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block space-y-6">
            {/* Seller Card */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-16" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
                <Skeleton className="h-px w-full" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </CardContent>
            </Card>

            {/* Contact Form Card */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-28" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-24 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="space-y-1">
                    <Skeleton className="h-8 w-12 mx-auto" />
                    <Skeleton className="h-3 w-10 mx-auto" />
                  </div>
                  <div className="space-y-1">
                    <Skeleton className="h-8 w-12 mx-auto" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Similar Listings */}
        <div className="mt-8 md:mt-12">
          <Skeleton className="h-7 w-40 mb-4 md:mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <Skeleton className="aspect-[4/3] w-full" />
                <CardContent className="p-2 md:p-4 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
