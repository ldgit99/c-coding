#include <stdio.h>

long factorial_iter(int n) {
    long result = 1;
    for (int i = 2; i <= n; i++) result *= i;
    return result;
}

int main(void) {
    int n;
    if (scanf("%d", &n) != 1) return 1;
    printf("%ld\n", factorial_iter(n));
    return 0;
}
