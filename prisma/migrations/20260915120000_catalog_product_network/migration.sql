-- CreateTable
CREATE TABLE "catalog_product_network" (
    "productId" TEXT NOT NULL,
    "networkKey" "BoatNetworkKey" NOT NULL,
    "portCount" INTEGER,

    CONSTRAINT "catalog_product_network_pkey" PRIMARY KEY ("productId","networkKey")
);

-- AddForeignKey
ALTER TABLE "catalog_product_network" ADD CONSTRAINT "catalog_product_network_productId_fkey" FOREIGN KEY ("productId") REFERENCES "catalog_product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
